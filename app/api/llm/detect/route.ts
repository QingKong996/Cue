import { NextResponse } from "next/server";
import { callDeepSeek } from "@/lib/llm/client";
import { buildDetectPrompt } from "@/lib/llm/prompts";
import { parseAddressingDecision } from "@/lib/llm/parsers";
import { MODEL_FLASH } from "@/lib/constants";
import type { TranscriptTurn, UserProfile } from "@/lib/types";

export async function POST(request: Request) {
  try {
    const { sentence, context, profile } = (await request.json()) as {
      sentence: string;
      context: TranscriptTurn[];
      profile: UserProfile;
    };

    if (!sentence) {
      return NextResponse.json(
        { error: "sentence is required" },
        { status: 400 },
      );
    }

    const messages = buildDetectPrompt(sentence, context, profile);
    const raw = await callDeepSeek(MODEL_FLASH, messages);
    const decision = parseAddressingDecision(raw);

    return NextResponse.json({ decision });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Unknown error in detect";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
