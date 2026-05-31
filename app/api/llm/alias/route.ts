import { NextResponse } from "next/server";
import { callDeepSeek } from "@/lib/llm/client";
import { buildAliasPrompt } from "@/lib/llm/prompts";
import { parseAliasCandidates } from "@/lib/llm/parsers";
import { MODEL_PRO } from "@/lib/constants";
import type { UserProfile } from "@/lib/types";

export async function POST(request: Request) {
  try {
    const { profile } = (await request.json()) as { profile: UserProfile };

    if (!profile?.canonicalName) {
      return NextResponse.json(
        { error: "profile.canonicalName is required" },
        { status: 400 },
      );
    }

    const messages = buildAliasPrompt(profile);
    const raw = await callDeepSeek(MODEL_PRO, messages);
    const aliases = parseAliasCandidates(raw);

    return NextResponse.json({ aliases });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Unknown error in alias generation";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
