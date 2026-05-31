// ── 称呼候选 ──

export type AliasKind =
  | "canonical"
  | "explicit_nickname"
  | "generated_alias"
  | "weak_alias"
  | "role_based";

export type AliasCandidate = {
  text: string;
  kind: AliasKind;
  prior: number;
  source: "user" | "llm" | "system";
};

// ── 用户画像 ──

export type UserProfile = {
  canonicalName: string;
  englishName?: string;
  nicknames?: string[];
  role?: string;
  team?: string;
  domainKeywords?: string[];
  aliases: AliasCandidate[];
};

// ── 转写 ──

export type TranscriptTurn = {
  id: string;
  timestamp: number;
  speaker?: string;
  text: string;
  isFinal: boolean;
};

// ── 音频源 ──

export type AudioSource = "mic" | "screen";

// ── 候选状态 ──

export type CandidateStatus = "watching" | "confirmed" | "rejected";

export type Candidate = {
  id: string;
  status: CandidateStatus;
  label: string;
  confidence: number;
  text: string;
};

// ── 语义判定 ──

export type AddresseeType =
  | "direct_name"
  | "nickname"
  | "weak_alias"
  | "role_context"
  | "not_user";

export type AddressingDecision = {
  addressedToUser: boolean;
  confidence: number;
  addresseeType: AddresseeType;
  reason: string;
  question: string | null;
};

// ── CueFrame ──

export type CueFrame = {
  version: number;
  timeframe: string;
  macroTopic: string;
  currentQuestion: string | null;
  recentDecisions: string[];
  openIssues: string[];
  userRelevantFacts: string[];
  likelyQuestionsToUser: string[];
  suggestedAnswerAngles: string[];
  sourceTurnIds: string[];
  updatedAt: number;
};

export type CueFrameUpdateInput = {
  previousFrame: CueFrame | null;
  newTurns: TranscriptTurn[];
  userProfile: UserProfile;
  updatedAt: number;
};

// ── 候选召回 ──

export type RecallHit = {
  alias: AliasCandidate;
  matchedText: string;
  hitType: "exact_name" | "nickname" | "weak_alias" | "second_person" | "domain_keyword";
  position: number;
};

// ── 决策 ──

export type DecisionAction = "show" | "watch" | "silent";

export type DetectionResult = {
  action: DecisionAction;
  confidence: number;
  candidate: Candidate;
  decision: AddressingDecision;
  cueText: string | null;
};

// ── 应用状态 ──

export type AppState =
  | "idle"
  | "configuring"
  | "listening"
  | "paused"
  | "error";
