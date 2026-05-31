import { NextResponse } from "next/server";
import { callDeepSeek } from "@/lib/llm/client";
import { buildCueFramePrompt } from "@/lib/llm/prompts";
import { parseCueFrame } from "@/lib/llm/parsers";
import { MODEL_PRO } from "@/lib/constants";
import type { CueFrameUpdateInput } from "@/lib/types";

export async function POST(request: Request) {
  try {
    const { input } = (await request.json()) as { input: CueFrameUpdateInput };

    if (!input?.newTurns || !input?.userProfile) {
      return NextResponse.json(
        { error: "input.newTurns and input.userProfile are required" },
        { status: 400 },
      );
    }

    const messages = buildCueFramePrompt(input);
    const raw = await callDeepSeek(MODEL_PRO, messages);
    const cueFrame = parseCueFrame(raw);

    return NextResponse.json({ cueFrame });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Unknown error in cueframe update";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
