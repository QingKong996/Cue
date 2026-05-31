import type {
  AddressingDecision,
  AliasCandidate,
  AliasKind,
  CueFrame,
} from "@/lib/types";

// ── Generic JSON parser ──

export function parseJsonFromLLM<T>(text: string): T {
  let cleaned = text.trim();

  // Strip markdown code blocks
  const codeBlockMatch = cleaned.match(
    /```(?:json)?\s*\n?([\s\S]*?)\n?```/,
  );
  if (codeBlockMatch) {
    cleaned = codeBlockMatch[1].trim();
  }

  // Remove trailing commas before } or ]
  cleaned = cleaned.replace(/,\s*([}\]])/g, "$1");

  try {
    return JSON.parse(cleaned) as T;
  } catch {
    throw new Error(`Failed to parse LLM JSON output: ${cleaned.slice(0, 200)}`);
  }
}

// ── Alias Candidates ──

const VALID_KINDS: AliasKind[] = [
  "canonical",
  "explicit_nickname",
  "generated_alias",
  "weak_alias",
  "role_based",
];

export function parseAliasCandidates(text: string): AliasCandidate[] {
  const raw = parseJsonFromLLM<unknown>(text);

  // Handle both plain array and { aliases: [...] } wrapper
  const arr = Array.isArray(raw)
    ? raw
    : (raw as Record<string, unknown>)?.aliases;

  if (!Array.isArray(arr)) {
    throw new Error("Expected AliasCandidate[], got non-array");
  }

  return arr.map((item, i) => {
    if (typeof item !== "object" || item === null) {
      throw new Error(`AliasCandidate[${i}] is not an object`);
    }
    const obj = item as Record<string, unknown>;

    if (typeof obj.text !== "string") {
      throw new Error(`AliasCandidate[${i}].text is not a string`);
    }
    if (!VALID_KINDS.includes(obj.kind as AliasKind)) {
      throw new Error(`AliasCandidate[${i}].kind "${obj.kind}" is invalid`);
    }
    if (typeof obj.prior !== "number") {
      throw new Error(`AliasCandidate[${i}].prior is not a number`);
    }

    return {
      text: obj.text as string,
      kind: obj.kind as AliasKind,
      prior: obj.prior as number,
      source: "llm" as const,
    };
  });
}

// ── Addressing Decision ──

const VALID_ADDRESSEE_TYPES = [
  "direct_name",
  "nickname",
  "weak_alias",
  "role_context",
  "not_user",
];

export function parseAddressingDecision(text: string): AddressingDecision {
  const raw = parseJsonFromLLM<Record<string, unknown>>(text);

  if (typeof raw.addressedToUser !== "boolean") {
    throw new Error("AddressingDecision.addressedToUser is not a boolean");
  }
  if (typeof raw.confidence !== "number") {
    throw new Error("AddressingDecision.confidence is not a number");
  }
  if (!VALID_ADDRESSEE_TYPES.includes(raw.addresseeType as string)) {
    throw new Error(
      `AddressingDecision.addresseeType "${raw.addresseeType}" is invalid`,
    );
  }
  if (typeof raw.reason !== "string") {
    throw new Error("AddressingDecision.reason is not a string");
  }

  return {
    addressedToUser: raw.addressedToUser as boolean,
    confidence: raw.confidence as number,
    addresseeType: raw.addresseeType as AddressingDecision["addresseeType"],
    reason: raw.reason as string,
    question: typeof raw.question === "string" ? raw.question : null,
  };
}

// ── CueFrame ──

export function parseCueFrame(text: string): CueFrame {
  const raw = parseJsonFromLLM<Record<string, unknown>>(text);

  if (typeof raw.version !== "number") {
    throw new Error("CueFrame.version is not a number");
  }
  if (typeof raw.timeframe !== "string") {
    throw new Error("CueFrame.timeframe is not a string");
  }
  if (typeof raw.macroTopic !== "string") {
    throw new Error("CueFrame.macroTopic is not a string");
  }
  if (!Array.isArray(raw.recentDecisions)) {
    throw new Error("CueFrame.recentDecisions is not an array");
  }
  if (!Array.isArray(raw.openIssues)) {
    throw new Error("CueFrame.openIssues is not an array");
  }
  if (!Array.isArray(raw.userRelevantFacts)) {
    throw new Error("CueFrame.userRelevantFacts is not an array");
  }
  if (!Array.isArray(raw.likelyQuestionsToUser)) {
    throw new Error("CueFrame.likelyQuestionsToUser is not an array");
  }
  if (!Array.isArray(raw.suggestedAnswerAngles)) {
    throw new Error("CueFrame.suggestedAnswerAngles is not an array");
  }
  if (!Array.isArray(raw.sourceTurnIds)) {
    throw new Error("CueFrame.sourceTurnIds is not an array");
  }
  if (typeof raw.updatedAt !== "number") {
    // LLM may return string timestamp or omit it — use current time
    raw.updatedAt = Date.now();
  }

  return {
    version: raw.version as number,
    timeframe: raw.timeframe as string,
    macroTopic: raw.macroTopic as string,
    currentQuestion:
      typeof raw.currentQuestion === "string" ? raw.currentQuestion : null,
    recentDecisions: raw.recentDecisions as string[],
    openIssues: raw.openIssues as string[],
    userRelevantFacts: raw.userRelevantFacts as string[],
    likelyQuestionsToUser: raw.likelyQuestionsToUser as string[],
    suggestedAnswerAngles: raw.suggestedAnswerAngles as string[],
    sourceTurnIds: raw.sourceTurnIds as string[],
    updatedAt: raw.updatedAt as number,
  };
}
