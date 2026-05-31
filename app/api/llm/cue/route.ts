import { NextResponse } from "next/server";
import { callDeepSeek } from "@/lib/llm/client";
import { buildCuePrompt } from "@/lib/llm/prompts";
import { MODEL_FLASH } from "@/lib/constants";
import type { CueFrame, TranscriptTurn } from "@/lib/types";

export async function POST(request: Request) {
  try {
    const { cueFrame, currentSentence, recentTurns } =
      (await request.json()) as {
        cueFrame: CueFrame;
        currentSentence: string;
        recentTurns: TranscriptTurn[];
      };

    if (!currentSentence) {
      return NextResponse.json(
        { error: "currentSentence is required" },
        { status: 400 },
      );
    }

    const messages = buildCuePrompt(cueFrame, currentSentence, recentTurns);
    const cueText = await callDeepSeek(MODEL_FLASH, messages);

    return NextResponse.json({ cueText });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Unknown error in cue generation";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
