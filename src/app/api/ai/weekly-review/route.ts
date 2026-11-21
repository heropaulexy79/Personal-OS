import { NextResponse } from "next/server";
import { z } from "zod";
import { callGroq, isGroqConfigured } from "@/lib/groq";

const WeeklyReviewSchema = z.object({
  weekStart: z.string(),
  weekEnd: z.string(),
  model: z.string().optional(),
  metrics: z.object({
    tasksCompleted: z.array(z.object({ title: z.string(), category: z.string() })),
    tasksDeferred: z.array(z.object({ title: z.string(), category: z.string() })),
    goals: z.array(z.object({ title: z.string(), progress: z.number(), category: z.string() })),
    habitConsistencyPct: z.number(),
    strugglingHabits: z.array(z.string()),
    focusHours: z.number(),
    topCategory: z.string().optional(),
    journalHighlights: z.array(z.string()),
  }),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = WeeklyReviewSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid weekly review payload" }, { status: 400 });
    }

    const { weekStart, weekEnd, metrics, model } = parsed.data;

    const fallback = {
      summary: `Between ${weekStart} and ${weekEnd}, you completed ${metrics.tasksCompleted.length} task(s), logged ${metrics.focusHours} hours of deep focus, and maintained ${metrics.habitConsistencyPct}% habit consistency.`,
      goalsProgressed: metrics.goals.slice(0, 4).map((g) => `${g.title} (${g.progress}%)`),
      accomplishments:
        metrics.tasksCompleted.length > 0
          ? metrics.tasksCompleted.slice(0, 5).map((t) => `Completed: ${t.title}`)
          : ["Maintained awareness of your commitments and took time to review."],
      areasNeedingAttention: [
        ...(metrics.tasksDeferred.length > 0
          ? [`${metrics.tasksDeferred.length} task(s) were deferred or remain overdue — review whether to break them down or drop them.`]
          : []),
        ...(metrics.strugglingHabits.length > 0
          ? [`Routines needing a gentle reset: ${metrics.strugglingHabits.join(", ")}.`]
          : []),
        ...(metrics.focusHours < 5
          ? ["Deep focus time was light this week — consider protecting one morning block each day."]
          : []),
      ].slice(0, 4),
      nextWeekAdjustments: [
        "Choose 1 primary goal outcome per day before opening email or messages.",
        metrics.strugglingHabits.length > 0
          ? `Use 'Resume Your Rhythm' on ${metrics.strugglingHabits[0]} with a smaller 10-minute version.`
          : "Maintain your current routine cadence and protect recovery breaks.",
        "Schedule a 20-minute mid-week check-in to catch scope creep early.",
      ],
    };

    if (fallback.areasNeedingAttention.length === 0) {
      fallback.areasNeedingAttention.push(
        "Execution was steady — watch for subtle overcommitment as new projects appear."
      );
    }

    if (!isGroqConfigured()) {
      return NextResponse.json({ mode: "mock", ...fallback });
    }

    try {
      const { content } = await callGroq({
        model,
        jsonMode: true,
        temperature: 0.4,
        maxTokens: 1200,
        messages: [
          {
            role: "system",
            content: `You are a reflective executive coach inside PERSONAL OS generating a weekly review from REAL user data.
Never fabricate numbers or accomplishments. Avoid guilt-based language.
Return strict JSON:
{
  "summary": string (2-3 thoughtful sentences),
  "goalsProgressed": string[],
  "accomplishments": string[],
  "areasNeedingAttention": string[],
  "nextWeekAdjustments": string[]
}`,
          },
          {
            role: "user",
            content: JSON.stringify({ weekStart, weekEnd, metrics }),
          },
        ],
      });

      const json = JSON.parse(content);
      return NextResponse.json({
        mode: "groq",
        summary: json.summary || fallback.summary,
        goalsProgressed: json.goalsProgressed || fallback.goalsProgressed,
        accomplishments: json.accomplishments || fallback.accomplishments,
        areasNeedingAttention: json.areasNeedingAttention || fallback.areasNeedingAttention,
        nextWeekAdjustments: json.nextWeekAdjustments || fallback.nextWeekAdjustments,
      });
    } catch {
      return NextResponse.json({ mode: "mock", ...fallback });
    }
  } catch {
    return NextResponse.json({ error: "Failed to generate weekly review" }, { status: 500 });
  }
}

