import { NextResponse } from "next/server";
import { z } from "zod";
import { callGroq, isGroqConfigured } from "@/lib/groq";
import { addDays, format, nextFriday, nextMonday, parseISO } from "date-fns";

const QuickCaptureSchema = z.object({
  input: z.string().min(2),
  today: z.string(),
  projects: z.array(z.object({ id: z.string(), title: z.string(), category: z.string() })),
  goals: z.array(z.object({ id: z.string(), title: z.string(), category: z.string() })),
  categories: z.array(z.string()),
  model: z.string().optional(),
});

function heuristicParse(
  input: string,
  today: string,
  projects: Array<{ id: string; title: string; category: string }>,
  categories: string[]
) {
  const lower = input.toLowerCase();
  const baseDate = parseISO(today);

  let dueDate: string | undefined;
  let dateFound = false;

  if (lower.includes("today") || lower.includes("tonight")) {
    dueDate = today;
    dateFound = true;
  } else if (lower.includes("tomorrow")) {
    dueDate = format(addDays(baseDate, 1), "yyyy-MM-dd");
    dateFound = true;
  } else if (lower.includes("friday")) {
    dueDate = format(nextFriday(baseDate), "yyyy-MM-dd");
    dateFound = true;
  } else if (lower.includes("monday")) {
    dueDate = format(nextMonday(baseDate), "yyyy-MM-dd");
    dateFound = true;
  } else if (lower.includes("next week")) {
    dueDate = format(addDays(baseDate, 7), "yyyy-MM-dd");
    dateFound = true;
  }

  let priority: "low" | "medium" | "high" | "urgent" = "medium";
  let priorityExplicit = false;
  if (lower.includes("urgent") || lower.includes("asap") || lower.includes("critical")) {
    priority = "urgent";
    priorityExplicit = true;
  } else if (lower.includes("high priority") || lower.includes("important")) {
    priority = "high";
    priorityExplicit = true;
  } else if (lower.includes("low priority") || lower.includes("whenever")) {
    priority = "low";
    priorityExplicit = true;
  }

  const matchedProject = projects.find((p) => {
    const words = p.title.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
    return words.some((w) => lower.includes(w));
  });

  const matchedCategory =
    matchedProject?.category ||
    categories.find((c) => lower.includes(c.toLowerCase())) ||
    "Personal Development";

  const durationMatch = lower.match(/(\d+)\s*(min|mins|minutes|hr|hrs|hour|hours)/);
  let estimatedMinutes = 45;
  if (durationMatch) {
    const val = Number(durationMatch[1]);
    estimatedMinutes = durationMatch[2].startsWith("h") ? val * 60 : val;
  }

  const cleanedTitle = input
    .replace(/\b(by|on)\s+(today|tomorrow|friday|monday|next week)\b/gi, "")
    .replace(/\b(urgent|asap|high priority|low priority)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\.$/, "");

  const ambiguities: string[] = [];
  if (!dateFound) ambiguities.push("No specific deadline was mentioned — defaulted to today.");
  if (!priorityExplicit) ambiguities.push("Priority was not explicitly stated — defaulted to Medium.");

  return {
    title: cleanedTitle || input.trim(),
    dueDate: dueDate || today,
    priority,
    estimatedMinutes,
    projectId: matchedProject?.id || "",
    projectTitle: matchedProject?.title || "",
    category: matchedCategory,
    needsConfirmation: ambiguities.length > 0,
    ambiguities,
  };
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = QuickCaptureSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid quick capture input" }, { status: 400 });
    }

    const { input, today, projects, goals, categories, model } = parsed.data;
    const fallback = heuristicParse(input, today, projects, categories);

    if (!isGroqConfigured()) {
      return NextResponse.json({ mode: "mock", parsed: fallback });
    }

    try {
      const { content } = await callGroq({
        model,
        jsonMode: true,
        temperature: 0.2,
        maxTokens: 450,
        messages: [
          {
            role: "system",
            content: `You parse natural language task capture for PERSONAL OS. Today's date is ${today}.
Return strict JSON:
{
  "title": string (clean actionable task title),
  "dueDate": "YYYY-MM-DD",
  "priority": "low" | "medium" | "high" | "urgent",
  "estimatedMinutes": number (15-240),
  "projectId": string (matching id from provided projects or ""),
  "goalId": string (matching id from provided goals or ""),
  "category": string (one of provided categories),
  "needsConfirmation": boolean (true if deadline, priority, or project is ambiguous),
  "ambiguities": string[] (brief notes on what was inferred)
}`,
          },
          {
            role: "user",
            content: JSON.stringify({ input, projects, goals, categories }),
          },
        ],
      });

      const json = JSON.parse(content);
      return NextResponse.json({
        mode: "groq",
        parsed: {
          ...fallback,
          ...json,
        },
      });
    } catch {
      return NextResponse.json({ mode: "mock", parsed: fallback });
    }
  } catch {
    return NextResponse.json({ error: "Failed to parse quick capture" }, { status: 500 });
  }
}

