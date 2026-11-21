import { NextResponse } from "next/server";
import { DEFAULT_GROQ_MODEL, GROQ_AVAILABLE_MODELS, isGroqConfigured } from "@/lib/groq";

export async function GET() {
  return NextResponse.json({
    provider: "groq",
    configured: isGroqConfigured(),
    defaultModel: DEFAULT_GROQ_MODEL,
    models: GROQ_AVAILABLE_MODELS,
  });
}

