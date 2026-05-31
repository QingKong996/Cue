import type {
  AddressingDecision,
  TranscriptTurn,
  UserProfile,
} from "@/lib/types";

const DEFAULT_DECISION: AddressingDecision = {
  addressedToUser: false,
  confidence: 0,
  addresseeType: "not_user",
  reason: "LLM 调用失败",
  question: null,
};

export async function judgeSemantic(
  sentence: string,
  context: TranscriptTurn[],
  profile: UserProfile,
): Promise<AddressingDecision> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const response = await fetch("/api/llm/detect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sentence, context, profile }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      return DEFAULT_DECISION;
    }

    const data = await response.json();
    const decision = data.decision as AddressingDecision;

    if (
      typeof decision?.confidence !== "number" ||
      typeof decision?.addressedToUser !== "boolean"
    ) {
      return DEFAULT_DECISION;
    }

    return decision;
  } catch {
    return DEFAULT_DECISION;
  }
}
