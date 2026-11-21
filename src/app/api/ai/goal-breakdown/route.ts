import { NextResponse } from "next/server";
import { z } from "zod";
import { callGroq, isGroqConfigured } from "@/lib/groq";
import { addDays, format, parseISO } from "date-fns";

const GoalBreakdownSchema = z.object({
  goal: z.object({
    id: z.string(),
    title: z.string(),
    description: z.string(),
    category: z.string(),
    targetDate: z.string(),
    priority: z.string(),
  }),
  visionStatement: z.string().optional(),
  model: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = GoalBreakdownSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid goal payload" }, { status: 400 });
    }

    const { goal, visionStatement, model } = parsed.data;
    const now = new Date();
    let target = addDays(now, 30);
    try {
      target = parseISO(goal.targetDate);
    } catch {
      // keep fallback
    }
    const spanDays = Math.max(7, Math.round((target.getTime() - now.getTime()) / 86400000));

    const fallback = {
      rationale: `Structured "${goal.title}" into 3 sequential milestones spaced across ${spanDays} days so each phase builds cleanly on the last without overloading any single week.`,
      milestones: [
        {
          title: `Define scope, success criteria & core plan for ${goal.title}`,
          targetDate: format(addDays(now, Math.max(3, Math.round(spanDays * 0.25))), "yyyy-MM-dd"),
          tasks: [
            {
              title: `Audit current state and key constraints for ${goal.title}`,
              estimatedMinutes: 45,
              priority: "high",
            },
            {
              title: "Draft concise execution checklist and resource requirements",
              estimatedMinutes: 40,
              priority: "medium",
            },
          ],
        },
        {
          title: "Execute core deliverable and gather early feedback",
          targetDate: format(addDays(now, Math.max(6, Math.round(spanDays * 0.65))), "yyyy-MM-dd"),
          tasks: [
            {
              title: `Complete primary deep-work sprint on ${goal.title}`,
              estimatedMinutes: 90,
              priority: "high",
            },
            {
              title: "Review progress against target outcome and adjust bottlenecks",
              estimatedMinutes: 30,
              priority: "medium",
            },
          ],
        },
        {
          title: "Finalize, polish, and close out goal",
          targetDate: format(target, "yyyy-MM-dd"),
          tasks: [
            {
              title: "Perform final quality check and resolve remaining gaps",
              estimatedMinutes: 60,
              priority: "high",
            },
            {
              title: "Document lessons learned and next-phase follow-ups",
              estimatedMinutes: 25,
              priority: "low",
            },
          ],
        },
      ],
    };

    if (!isGroqConfigured()) {
      return NextResponse.json({ mode: "mock", ...fallback });
    }

    try {
      const { content } = await callGroq({
        model,
        jsonMode: true,
        temperature: 0.35,
        maxTokens: 1200,
        messages: [
          {
            role: "system",
            content: `You are a strategic execution coach inside PERSONAL OS. Break the user's goal into 3-4 practical, realistic milestones and 2-3 concrete actionable tasks per milestone.
Return strict JSON:
{
  "rationale": string (1-2 sentences explaining the phasing),
  "milestones": [
    {
      "title": string,
      "targetDate": "YYYY-MM-DD" (between today and the goal's targetDate),
      "tasks": [
        { "title": string, "estimatedMinutes": number (20-120), "priority": "low"|"medium"|"high"|"urgent" }
      ]
    }
  ]
}`,
          },
          {
            role: "user",
            content: JSON.stringify({
              today: format(now, "yyyy-MM-dd"),
              goal,
              visionStatement: visionStatement || "",
            }),
          },
        ],
      });

      const json = JSON.parse(content);
      if (!Array.isArray(json.milestones) || json.milestones.length === 0) {
        return NextResponse.json({ mode: "mock", ...fallback });
      }
      return NextResponse.json({ mode: "groq", ...json });
    } catch {
      return NextResponse.json({ mode: "mock", ...fallback });
    }
  } catch {
    return NextResponse.json({ error: "Failed to break down goal" }, { status: 500 });
  }
}

