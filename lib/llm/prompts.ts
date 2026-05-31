import type {
  AddressingDecision,
  AliasCandidate,
  CueFrame,
  CueFrameUpdateInput,
  TranscriptTurn,
  UserProfile,
} from "@/lib/types";
import type { DeepSeekMessage } from "./client";

// ── Alias Prompt ──

export function buildAliasPrompt(profile: UserProfile): DeepSeekMessage[] {
  return [
    {
      role: "system",
      content: `你是一个称呼分析助手。根据用户提供的个人信息，生成该用户可能被他人称呼的所有候选称呼列表。

规则：
- 每个候选必须包含以下字段（使用英文字段名）：
  - "text": 称呼文本（string）
  - "kind": 类型，只能是 "canonical" | "explicit_nickname" | "generated_alias" | "weak_alias" | "role_based"
  - "prior": 置信度（0~1 的数字）
  - "source": 固定为 "llm"
- canonical: 用户的真实姓名（必含）
- explicit_nickname: 用户明确提供的昵称
- generated_alias: LLM 生成的可能称呼
- weak_alias: 可能的简称、缩写（如名字的一部分）
- role_based: 基于角色/职位的称呼（如"张工"、"李总"）

严格输出 JSON 数组，字段名必须使用 text/kind/prior/source，不要输出其他内容。`,
    },
    {
      role: "user",
      content: JSON.stringify({
        canonicalName: profile.canonicalName,
        englishName: profile.englishName,
        nicknames: profile.nicknames,
        role: profile.role,
        team: profile.team,
      }),
    },
  ];
}

// ── Detect Prompt ──

export function buildDetectPrompt(
  sentence: string,
  context: TranscriptTurn[],
  profile: UserProfile,
): DeepSeekMessage[] {
  const aliasTexts = profile.aliases.map((a) => a.text).join("、");
  const contextText = context
    .slice(-10)
    .map((t) => `[${t.speaker ?? "未知"}] ${t.text}`)
    .join("\n");

  return [
    {
      role: "system",
      content: `你是一个会议场景中的语义判定助手。判断当前发言是否在直接向用户提问或对用户说话。

用户信息：
- 姓名：${profile.canonicalName}
- 昵称/称呼：${aliasTexts || "无"}
- 角色：${profile.role ?? "未知"}

判定规则：
- addresseeType:
  - "direct_name": 直接叫了用户全名
  - "nickname": 叫了用户的昵称
  - "weak_alias": 叫了用户的简称或部分名字
  - "role_context": 通过上下文（如"你来回答一下"）可以推断是在对用户说话
  - "not_user": 不是对用户说的
- confidence: 0~1 的置信度
- question: 如果对方问了一个问题，提取问题内容；否则为 null

严格输出以下 JSON 格式，不要输出其他内容：
{
  "addressedToUser": boolean,
  "confidence": number,
  "addresseeType": "direct_name" | "nickname" | "weak_alias" | "role_context" | "not_user",
  "reason": "string",
  "question": "string | null"
}`,
    },
    {
      role: "user",
      content: `最近对话上下文：\n${contextText}\n\n当前待判定发言：\n${sentence}`,
    },
  ];
}

// ── CueFrame Prompt ──

export function buildCueFramePrompt(
  input: CueFrameUpdateInput,
): DeepSeekMessage[] {
  const turnsText = input.newTurns
    .map((t) => `[${t.speaker ?? "未知"}] ${t.text}`)
    .join("\n");

  const aliasTexts = input.userProfile.aliases
    .map((a) => a.text)
    .join("、");

  const prevFrameText = input.previousFrame
    ? JSON.stringify(input.previousFrame, null, 2)
    : "无（首次生成）";

  return [
    {
      role: "system",
      content: `你是一个会议上下文管理助手。根据最新的对话内容，增量更新会议上下文帧（CueFrame）。

用户信息：
- 姓名：${input.userProfile.canonicalName}
- 称呼：${aliasTexts || "无"}
- 角色：${input.userProfile.role ?? "未知"}

CueFrame 字段说明：
- version: 版本号，如有前一帧则 +1，否则为 1
- timeframe: 当前讨论的时间范围概要（如"近5分钟"）
- macroTopic: 当前大主题
- currentQuestion: 当前正在讨论的问题
- recentDecisions: 最近做出的决定（保留最近 3~5 条）
- openIssues: 仍未解决的议题
- userRelevantFacts: 与用户相关的关键事实
- likelyQuestionsToUser: 可能被问到用户的问题
- suggestedAnswerAngles: 建议的回答角度
- sourceTurnIds: 本帧所依据的转写 ID 列表
- updatedAt: 更新时间戳

严格输出 CueFrame JSON，不要输出其他内容。`,
    },
    {
      role: "user",
      content: `前一帧：\n${prevFrameText}\n\n新对话内容：\n${turnsText}\n\n当前时间戳：${input.updatedAt}`,
    },
  ];
}

// ── Cue Prompt ──

export function buildCuePrompt(
  cueFrame: CueFrame,
  currentSentence: string,
  recentTurns: TranscriptTurn[],
): DeepSeekMessage[] {
  const turnsText = recentTurns
    .slice(-6)
    .map((t) => `[${t.speaker ?? "未知"}] ${t.text}`)
    .join("\n");

  return [
    {
      role: "system",
      content: `你是一个实时会议助手。你需要为用户生成简短的提示文字，帮助用户在会议中回答问题或参与讨论。

规则：
- 生成一句话总结 + 最多 2~3 个要点（简短短语即可）
- 内容必须简洁、可快速阅读
- 用中文输出
- 不要输出多余内容，只输出提示文字本身
- 如果当前发言不涉及用户，输出"（无需回应）"`,
    },
    {
      role: "user",
      content: `CueFrame 上下文：\n${JSON.stringify(cueFrame, null, 2)}\n\n最近对话：\n${turnsText}\n\n当前发言：\n${currentSentence}`,
    },
  ];
}
