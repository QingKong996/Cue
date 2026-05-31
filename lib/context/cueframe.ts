import { CUEFRAME_UPDATE_INTERVAL_MS } from "@/lib/constants";
import type { CueFrame, CueFrameUpdateInput } from "@/lib/types";

export function createCueFrameManager() {
  let currentFrame: CueFrame | null = null;
  let lastUpdateTime = 0;

  async function update(input: CueFrameUpdateInput): Promise<CueFrame> {
    const response = await fetch("/api/llm/cueframe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ input }),
    });

    if (!response.ok) {
      throw new Error(`CueFrame update failed: ${response.status}`);
    }

    const data = await response.json();
    if (data.error) {
      throw new Error(data.error);
    }

    currentFrame = data.cueFrame as CueFrame;
    lastUpdateTime = Date.now();
    return currentFrame;
  }

  function getCurrent(): CueFrame | null {
    return currentFrame;
  }

  function shouldUpdate(): boolean {
    if (lastUpdateTime === 0) return true;
    return Date.now() - lastUpdateTime >= CUEFRAME_UPDATE_INTERVAL_MS;
  }

  function formatForDisplay(frame: CueFrame): string {
    const join = (arr: string[]) => (arr.length ? arr.join("；") : "（无）");
    return [
      `时间范围：${frame.timeframe}`,
      `宏观话题：${frame.macroTopic}`,
      `关键变化：${join(frame.recentDecisions)}`,
      `开放问题：${join(frame.openIssues)}`,
      `与你相关：${join(frame.userRelevantFacts)}`,
      `可回应角度：${join(frame.suggestedAnswerAngles)}`,
    ].join("\n");
  }

  return { update, getCurrent, shouldUpdate, formatForDisplay };
}
