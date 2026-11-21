import { NextResponse } from "next/server";
import { z } from "zod";
import { callGroq, isGroqConfigured } from "@/lib/groq";
import { addDays, format } from "date-fns";

const ChatSchema = z.object({
  message: z.string().min(1),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string(),
      })
    )
    .default([]),
  model: z.string().optional(),
  workspaceContext: z.object({
    today: z.string(),
    userName: z.string(),
    visionNorthStar: z.string().optional(),
    visionStatement: z.string().optional(),
    activeGoals: z.array(
      z.object({
        id: z.string(),
        title: z.string(),
        category: z.string(),
        progress: z.number(),
        priority: z.string(),
        targetDate: z.string(),
      })
    ),
    openTasks: z.array(
      z.object({
        id: z.string(),
        title: z.string(),
        priority: z.string(),
        dueDate: z.string().optional(),
        scheduledDate: z.string().optional(),
        estimatedMinutes: z.number(),
        category: z.string(),
        goalId: z.string().optional(),
      })
    ),
    completedTasksCount: z.number(),
    habits: z.array(
      z.object({
        title: z.string(),
        category: z.string(),
        recentRatePct: z.number(),
      })
    ),
    focusMinutesLast7Days: z.number(),
    recentJournalTitles: z.array(z.string()),
    maxDailyWorkloadHours: z.number(),
  }),
});

function buildSmartMockReply(
  message: string,
  ctx: z.infer<typeof ChatSchema>["workspaceContext"]
) {
  const lower = message.toLowerCase();
  const todayTasks = ctx.openTasks.filter(
    (t) => t.scheduledDate === ctx.today || t.dueDate === ctx.today
  );
  const overdueTasks = ctx.openTasks.filter((t) => t.dueDate && t.dueDate < ctx.today);
  const tomorrow = format(addDays(new Date(), 1), "yyyy-MM-dd");

  const proposedActions: Array<{
    id: string;
    type: "create_task" | "reschedule_task" | "defer_task";
    label: string;
    description: string;
    payload: Record<string, unknown>;
    status: "pending";
  }> = [];

  if (lower.includes("focus on today") || lower.includes("what should i")) {
    const top = todayTasks[0] || ctx.openTasks[0];
    const reply = top
      ? `Based on your current goals and schedule, here is where your attention will have the highest leverage today:\n\n1. **Primary Focus:** *${top.title}* (${top.estimatedMinutes}m, ${top.priority} priority).\n${overdueTasks.length > 0 ? `2. **Clear Friction:** You have ${overdueTasks.length} overdue item(s), starting with *${overdueTasks[0].title}*.\n` : ""}3. **Capacity Check:** You have ${todayTasks.length} open tasks scheduled today totaling ${Math.round(todayTasks.reduce((a, b) => a + b.estimatedMinutes, 0) / 60 * 10) / 10}h against your ${ctx.maxDailyWorkloadHours}h cap.\n\nWould you like me to protect a 50-minute focus block for your top task?`
      : `Your task list is currently clear. Consider reviewing your Vision or adding 1–2 meaningful steps toward your active goals.`;
    return { reply, proposedActions };
  }

  if (lower.includes("neglect") || lower.includes("goal")) {
    const taskGoalIds = new Set(ctx.openTasks.map((t) => t.goalId).filter(Boolean));
    const neglected = ctx.activeGoals.filter((g) => !taskGoalIds.has(g.id) || g.progress < 40);
    const targetGoal = neglected[0] || ctx.activeGoals[0];
    if (targetGoal) {
      proposedActions.push({
        id: `act_${Date.now()}`,
        type: "create_task",
        label: `Add 30m step for "${targetGoal.title}"`,
        description: `Creates a focused 30-minute task linked to ${targetGoal.title} scheduled for tomorrow.`,
        payload: {
          title: `Define next concrete step for ${targetGoal.title}`,
          priority: "medium",
          estimatedMinutes: 30,
          category: targetGoal.category,
          goalId: targetGoal.id,
          scheduledDate: tomorrow,
          dueDate: tomorrow,
        },
        status: "pending",
      });
    }
    const reply =
      neglected.length > 0
        ? `Looking at your active goals and open tasks, these goals are receiving the least active attention:\n\n${neglected.map((g) => `- **${g.title}** (${g.category}) — ${g.progress}% complete, target ${g.targetDate}`).join("\n")}\n\nI've drafted a small 30-minute restart task below. Approve it if you'd like me to add it to your workspace.`
        : `All ${ctx.activeGoals.length} of your active goals have open tasks moving them forward. Your lowest-progress goal is **${ctx.activeGoals.sort((a, b) => a.progress - b.progress)[0]?.title || "none"}**.`;
    return { reply, proposedActions };
  }

  if (lower.includes("overload") || lower.includes("reorganize") || lower.includes("reschedule")) {
    const deferCandidates = todayTasks
      .filter((t) => t.priority === "low" || t.priority === "medium")
      .slice(0, 2);
    deferCandidates.forEach((t, idx) => {
      proposedActions.push({
        id: `act_resched_${Date.now()}_${idx}`,
        type: "reschedule_task",
        label: `Move "${t.title}" to tomorrow`,
        description: `Reschedules this ${t.priority}-priority (${t.estimatedMinutes}m) task to ${tomorrow} to free up focus capacity.`,
        payload: {
          taskId: t.id,
          newDate: tomorrow,
        },
        status: "pending",
      });
    });

    const totalMins = todayTasks.reduce((a, b) => a + b.estimatedMinutes, 0);
    const reply = `You currently have **${todayTasks.length} open tasks** scheduled today (~${(totalMins / 60).toFixed(1)} hours vs. your ${ctx.maxDailyWorkloadHours}h limit).\n\nTo restore calm focus, keep your top 2 urgent/high tasks today and move lower-leverage items to tomorrow. Review the proposed adjustments below before applying them.`;
    return { reply, proposedActions };
  }

  if (lower.includes("capture") || lower.includes("add a task") || lower.includes("task:")) {
    const cleaned = message
      .replace(/capture this thought as a task:?/i, "")
      .replace(/add a task:?/i, "")
      .trim();
    const title = cleaned.length > 3 ? cleaned : "Follow up on captured thought";
    proposedActions.push({
      id: `act_cap_${Date.now()}`,
      type: "create_task",
      label: `Create task: "${title}"`,
      description: `Adds "${title}" to your task list for today (30m, medium priority).`,
      payload: {
        title,
        priority: "medium",
        estimatedMinutes: 30,
        category: "Personal Development",
        scheduledDate: ctx.today,
        dueDate: ctx.today,
      },
      status: "pending",
    });
    return {
      reply: `I've structured that into a task proposal below. Click **Approve** to save it to your workspace, or let me know if you want a different deadline or goal link.`,
      proposedActions,
    };
  }

  if (lower.includes("pattern") || lower.includes("reflect") || lower.includes("week")) {
    const avgHabit =
      ctx.habits.length > 0
        ? Math.round(ctx.habits.reduce((a, h) => a + h.recentRatePct, 0) / ctx.habits.length)
        : 0;
    const weakestHabit = [...ctx.habits].sort((a, b) => a.recentRatePct - b.recentRatePct)[0];
    return {
      reply: `Here are the patterns visible in your actual workspace data:\n\n- **Deep Focus:** ${(ctx.focusMinutesLast7Days / 60).toFixed(1)} hours logged over the last 7 days.\n- **Execution:** ${ctx.completedTasksCount} completed tasks total, with ${overdueTasks.length} currently overdue.\n- **Routines:** ${avgHabit}% average habit consistency.${weakestHabit ? ` *${weakestHabit.title}* (${weakestHabit.recentRatePct}%) could benefit from a lighter restart.` : ""}\n\nWhat feels most energizing—and what felt like friction—over the past few days?`,
      proposedActions,
    };
  }

  return {
    reply: `I'm reviewing your current context (${ctx.activeGoals.length} active goals, ${todayTasks.length} tasks scheduled today, ${(ctx.focusMinutesLast7Days / 60).toFixed(1)}h focus this week).\n\nTo give you the sharpest recommendation, would you like to:\n- Prioritize today's top 2 outcomes\n- Rebalance an overloaded schedule\n- Identify which long-term goal needs attention\n- Capture a new task or break down an ambition?`,
    proposedActions,
  };
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = ChatSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid chat request" }, { status: 400 });
    }

    const { message, history, workspaceContext, model } = parsed.data;

    if (!isGroqConfigured()) {
      const mock = buildSmartMockReply(message, workspaceContext);
      return NextResponse.json({
        mode: "mock",
        reply: mock.reply,
        proposedActions: mock.proposedActions,
      });
    }

    try {
      const { content } = await callGroq({
        model,
        jsonMode: true,
        temperature: 0.45,
        maxTokens: 1400,
        messages: [
          {
            role: "system",
            content: `You are the AI Personal Assistant inside PERSONAL OS — a calm, incisive executive assistant, strategic thinking partner, and reflection companion.
Philosophy: "Your daily activities should be an expression of your long-term vision, not a distraction from it."

Rules:
- Ground every observation strictly in the user's ACTUAL workspaceContext JSON. Never invent statistics or tasks.
- Avoid generic motivational clichés and guilt-based productivity language.
- Explain your reasoning concisely and practically.
- If recommending concrete changes (creating a task, rescheduling a task, deferring a task, or adding a milestone), include them in "proposedActions" so the user can explicitly review and approve them. Never assume they are already applied.

Return strict JSON:
{
  "reply": string (markdown formatted, clear, thoughtful),
  "proposedActions": [
    {
      "id": string,
      "type": "create_task" | "reschedule_task" | "defer_task" | "create_milestone",
      "label": string,
      "description": string,
      "payload": object,
      "status": "pending"
    }
  ]
}

User Workspace Context:
${JSON.stringify(workspaceContext)}`,
          },
          ...history.slice(-8).map((h) => ({
            role: h.role,
            content: h.content,
          })),
          { role: "user", content: message },
        ],
      });

      const json = JSON.parse(content) as {
        reply?: string;
        proposedActions?: unknown[];
      };

      return NextResponse.json({
        mode: "groq",
        reply: json.reply || "I'm ready to help—could you share a bit more detail?",
        proposedActions: Array.isArray(json.proposedActions) ? json.proposedActions : [],
      });
    } catch {
      const mock = buildSmartMockReply(message, workspaceContext);
      return NextResponse.json({
        mode: "mock",
        reply: mock.reply,
        proposedActions: mock.proposedActions,
      });
    }
  } catch {
    return NextResponse.json({ error: "Failed to process AI message" }, { status: 500 });
  }
}

