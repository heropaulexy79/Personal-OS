import { NextResponse } from "next/server";
import { z } from "zod";
import { callGroq, isGroqConfigured } from "@/lib/groq";
import { minutesToTime, timeToMinutes } from "@/lib/utils";

const PlanDaySchema = z.object({
  date: z.string(),
  workStartHour: z.string(),
  workEndHour: z.string(),
  maxDailyWorkloadHours: z.number(),
  preferredFocusMinutes: z.number(),
  preferredBreakMinutes: z.number(),
  fixedBlocks: z.array(
    z.object({
      title: z.string(),
      startTime: z.string(),
      endTime: z.string(),
      type: z.enum(["focus", "routine", "meeting", "break", "admin"]),
    })
  ),
  tasks: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      priority: z.enum(["low", "medium", "high", "urgent"]),
      estimatedMinutes: z.number(),
      dueDate: z.string().optional(),
      category: z.string(),
      goalTitle: z.string().optional(),
    })
  ),
  habits: z.array(
    z.object({
      title: z.string(),
      reminderTime: z.string().optional(),
    })
  ),
  model: z.string().optional(),
});

const PRIORITY_WEIGHT = { urgent: 4, high: 3, medium: 2, low: 1 };

function buildAlgorithmicSchedule(input: z.infer<typeof PlanDaySchema>) {
  const startMin = timeToMinutes(input.workStartHour || "08:30");
  const endMin = timeToMinutes(input.workEndHour || "17:30");
  const maxWorkMin = Math.round((input.maxDailyWorkloadHours || 6) * 60);
  const breakMin = Math.max(10, input.preferredBreakMinutes || 10);

  // Start with fixed commitments
  const occupied: Array<{
    start: number;
    end: number;
    title: string;
    type: "focus" | "routine" | "meeting" | "break" | "admin";
    taskId?: string;
    rationale?: string;
    isFixed?: boolean;
  }> = input.fixedBlocks.map((b) => ({
    start: timeToMinutes(b.startTime),
    end: timeToMinutes(b.endTime),
    title: b.title,
    type: b.type,
    isFixed: true,
    rationale: "Fixed commitment preserved.",
  }));

  // Add lunch break if none overlaps 12:00-13:30
  const lunchStart = 12 * 60 + 15;
  const lunchEnd = 13 * 60;
  const hasMiddayBlock = occupied.some((o) => o.start < lunchEnd && o.end > lunchStart);
  if (!hasMiddayBlock && lunchStart >= startMin && lunchEnd <= endMin) {
    occupied.push({
      start: lunchStart,
      end: lunchEnd,
      title: "Midday Lunch & Unplugged Reset",
      type: "break",
      rationale: "Protects afternoon cognitive clarity.",
    });
  }

  occupied.sort((a, b) => a.start - b.start);

  // Sort tasks by overdue/due today + priority + goal alignment
  const sortedTasks = [...input.tasks].sort((a, b) => {
    const aDue = a.dueDate && a.dueDate <= input.date ? 2 : 0;
    const bDue = b.dueDate && b.dueDate <= input.date ? 2 : 0;
    if (bDue !== aDue) return bDue - aDue;
    const pDiff = PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority];
    if (pDiff !== 0) return pDiff;
    return (b.goalTitle ? 1 : 0) - (a.goalTitle ? 1 : 0);
  });

  let scheduledWorkMinutes = 0;
  const deferredTasks: Array<{ taskId: string; title: string; reason: string }> = [];

  const fitsInSlot = (slotStart: number, slotEnd: number, dur: number) =>
    slotEnd - slotStart >= dur;

  const findNextSlot = (dur: number): number | null => {
    const sorted = [...occupied].sort((a, b) => a.start - b.start);
    let cursor = startMin;
    for (const block of sorted) {
      if (block.end <= cursor) continue;
      if (fitsInSlot(cursor, block.start, dur)) {
        return cursor;
      }
      cursor = Math.max(cursor, block.end + 5);
    }
    if (fitsInSlot(cursor, endMin, dur)) return cursor;
    return null;
  };

  for (const task of sortedTasks) {
    const dur = Math.min(Math.max(task.estimatedMinutes || 45, 20), 120);
    if (scheduledWorkMinutes + dur > maxWorkMin) {
      deferredTasks.push({
        taskId: task.id,
        title: task.title,
        reason: `Exceeds your ${input.maxDailyWorkloadHours}h daily workload cap; moving protects focus quality.`,
      });
      continue;
    }

    const slot = findNextSlot(dur);
    if (slot === null) {
      deferredTasks.push({
        taskId: task.id,
        title: task.title,
        reason: "No non-overlapping window left within working hours.",
      });
      continue;
    }

    occupied.push({
      start: slot,
      end: slot + dur,
      title: task.title,
      taskId: task.id,
      type: task.priority === "low" ? "admin" : "focus",
      rationale: task.goalTitle
        ? `Prioritized (${task.priority}) — directly advances "${task.goalTitle}".`
        : `Prioritized (${task.priority}${task.dueDate && task.dueDate <= input.date ? ", due today/overdue" : ""}).`,
    });
    scheduledWorkMinutes += dur;

    // Add a short recovery break after >= 45m focus blocks if room allows
    if (dur >= 45) {
      const breakStart = slot + dur;
      const breakEnd = breakStart + breakMin;
      const overlaps = occupied.some(
        (o) => o.start < breakEnd && o.end > breakStart && !(o.start === slot && o.end === breakStart)
      );
      if (!overlaps && breakEnd <= endMin) {
        occupied.push({
          start: breakStart,
          end: breakEnd,
          title: "Short Recovery Break",
          type: "break",
          rationale: "Prevents attention fatigue between deep work blocks.",
        });
      }
    }
  }

  occupied.sort((a, b) => a.start - b.start);

  const blocks = occupied.map((o) => ({
    title: o.title,
    taskId: o.taskId,
    startTime: minutesToTime(o.start),
    endTime: minutesToTime(o.end),
    type: o.type,
    rationale: o.rationale || "",
    isFixed: Boolean(o.isFixed),
  }));

  return {
    summary: `Scheduled ${Math.round((scheduledWorkMinutes / 60) * 10) / 10}h of focused work across ${blocks.filter((b) => b.type === "focus" || b.type === "admin").length} task blocks with recovery breaks, respecting your ${input.workStartHour}–${input.workEndHour} window and ${input.maxDailyWorkloadHours}h workload cap.${deferredTasks.length > 0 ? ` Recommended deferring ${deferredTasks.length} lower-priority item(s).` : ""}`,
    blocks,
    deferredTasks,
  };
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = PlanDaySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid daily planning payload" }, { status: 400 });
    }

    const input = parsed.data;
    const deterministic = buildAlgorithmicSchedule(input);

    if (!isGroqConfigured()) {
      return NextResponse.json({ mode: "mock", ...deterministic });
    }

    try {
      const { content } = await callGroq({
        model: input.model,
        jsonMode: true,
        temperature: 0.25,
        maxTokens: 1600,
        messages: [
          {
            role: "system",
            content: `You are an elite executive planning assistant inside PERSONAL OS.
Create a realistic, non-overlapping daily schedule for ${input.date} between ${input.workStartHour} and ${input.workEndHour}.
Rules:
1. NEVER overlap time blocks.
2. Preserve all fixedBlocks verbatim with isFixed: true.
3. Respect maxDailyWorkloadHours (${input.maxDailyWorkloadHours}h) — do NOT overload the user.
4. Prioritize urgent/important and goal-aligned tasks early in the day.
5. Include short recovery breaks and a midday lunch break.
6. Defer excess tasks into deferredTasks with a thoughtful reason.
Return strict JSON:
{
  "summary": string (2 sentences explaining the plan),
  "blocks": [
    { "title": string, "taskId": string|null, "startTime": "HH:mm", "endTime": "HH:mm", "type": "focus"|"routine"|"meeting"|"break"|"admin", "rationale": string, "isFixed": boolean }
  ],
  "deferredTasks": [
    { "taskId": string, "title": string, "reason": string }
  ]
}`,
          },
          {
            role: "user",
            content: JSON.stringify({
              fixedBlocks: input.fixedBlocks,
              tasks: input.tasks,
              habits: input.habits,
              preferredFocusMinutes: input.preferredFocusMinutes,
              preferredBreakMinutes: input.preferredBreakMinutes,
            }),
          },
        ],
      });

      const json = JSON.parse(content);
      if (!Array.isArray(json.blocks) || json.blocks.length === 0) {
        return NextResponse.json({ mode: "mock", ...deterministic });
      }
      return NextResponse.json({
        mode: "groq",
        summary: json.summary || deterministic.summary,
        blocks: json.blocks,
        deferredTasks: Array.isArray(json.deferredTasks) ? json.deferredTasks : [],
      });
    } catch {
      return NextResponse.json({ mode: "mock", ...deterministic });
    }
  } catch {
    return NextResponse.json({ error: "Failed to plan day" }, { status: 500 });
  }
}

