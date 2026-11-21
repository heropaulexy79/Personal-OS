import { NextResponse } from "next/server";
import { z } from "zod";
import { callGroq, isGroqConfigured } from "@/lib/groq";

const DailyInsightSchema = z.object({
  date: z.string(),
  model: z.string().optional(),
  context: z.object({
    todayTasksCount: z.number(),
    highPriorityCount: z.number(),
    overdueCount: z.number(),
    completedTodayCount: z.number(),
    totalEstimatedMinutesToday: z.number(),
    maxWorkloadHours: z.number(),
    activeGoalsCount: z.number(),
    habitsDoneToday: z.number(),
    activeHabitsCount: z.number(),
    focusMinutesToday: z.number(),
    topTaskTitle: z.string().optional(),
    neglectedGoalTitle: z.string().optional(),
  }),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = DailyInsightSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request payload" }, { status: 400 });
    }

    const { context, model } = parsed.data;
    const workloadHours = Number((context.totalEstimatedMinutesToday / 60).toFixed(1));

    // Deterministic, data-grounded fallback
    const buildDataGroundedFallback = () => {
      if (context.overdueCount > 0 && workloadHours > context.maxWorkloadHours) {
        return {
          headline: "Schedule Load Advisory",
          insight: `You have ${context.todayTasksCount} tasks scheduled today (~${workloadHours}h vs your ${context.maxWorkloadHours}h limit) plus ${context.overdueCount} overdue item${context.overdueCount > 1 ? "s" : ""}. Consider deferring ${Math.min(2, Math.max(1, context.todayTasksCount - 3))} lower-priority tasks to protect deep focus on ${context.topTaskTitle || "your top priority"}.`,
          suggestion: "Open Daily Planner to rebalance today's time blocks.",
        };
      }
      if (context.overdueCount > 0) {
        return {
          headline: "Clear Overdue Friction",
          insight: `You have ${context.overdueCount} overdue task${context.overdueCount > 1 ? "s" : ""} competing with ${context.todayTasksCount} items today. Clearing or intentionally rescheduling them will reduce background cognitive load.`,
          suggestion: "Review overdue items in Tasks or let AI reorganize today.",
        };
      }
      if (context.neglectedGoalTitle) {
        return {
          headline: "Long-Term Alignment Check",
          insight: `Your goal "${context.neglectedGoalTitle}" has no active task scheduled today. Even a single 30-minute focus block keeps momentum alive without overloading your day.`,
          suggestion: "Schedule one small step toward this goal.",
        };
      }
      return {
        headline: "Balanced Execution Window",
        insight: `You have ${context.todayTasksCount} tasks planned (~${workloadHours}h) and ${context.habitsDoneToday}/${context.activeHabitsCount} routines completed today. Protect an uninterrupted focus block for "${context.topTaskTitle || "your main priority"}".`,
        suggestion: "Start a Focus Session to build early momentum.",
      };
    };

    if (!isGroqConfigured()) {
      return NextResponse.json({
        mode: "mock",
        ...buildDataGroundedFallback(),
      });
    }

    try {
      const { content } = await callGroq({
        model,
        jsonMode: true,
        temperature: 0.35,
        maxTokens: 350,
        messages: [
          {
            role: "system",
            content:
              "You are a calm, perceptive executive assistant inside PERSONAL OS. Produce ONE concise, data-grounded daily insight in JSON: {\"headline\": string (3-5 words), \"insight\": string (1-2 sentences citing ONLY the provided numbers, never fabricate stats, no guilt or generic motivational quotes), \"suggestion\": string (1 short actionable sentence)}.",
          },
          {
            role: "user",
            content: JSON.stringify({ ...context, workloadHours }),
          },
        ],
      });

      const json = JSON.parse(content) as {
        headline?: string;
        insight?: string;
        suggestion?: string;
      };
      const fb = buildDataGroundedFallback();
      return NextResponse.json({
        mode: "groq",
        headline: json.headline || fb.headline,
        insight: json.insight || fb.insight,
        suggestion: json.suggestion || fb.suggestion,
      });
    } catch {
      return NextResponse.json({
        mode: "mock",
        ...buildDataGroundedFallback(),
      });
    }
  } catch {
    return NextResponse.json({ error: "Failed to generate daily insight" }, { status: 500 });
  }
}

