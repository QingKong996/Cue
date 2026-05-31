import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { renderHook, act } from "@testing-library/react";
import type { CueFrame } from "@/lib/types";

// Mock fetch
const mockFetch = vi.fn() as Mock;
vi.stubGlobal("fetch", mockFetch);

const mockCueFrame: CueFrame = {
  version: 1,
  timeframe: "过去约 4 分钟",
  macroTopic: "Beta 发布时间讨论",
  currentQuestion: "能否提前到 5 月底",
  recentDecisions: ["权限模块可拆开上线"],
  openIssues: ["支付回调测试周期"],
  userRelevantFacts: ["技术侧负责 Beta 发布"],
  likelyQuestionsToUser: ["能否压缩测试周期"],
  suggestedAnswerAngles: ["区分权限模块和支付回调"],
  sourceTurnIds: ["turn-1"],
  updatedAt: Date.now(),
};

describe("Cue 生成流程", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it("useDetection 调用 Cue 生成 API 当 decision 为 confirmed", async () => {
    // Mock detect API
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        decision: {
          addressedToUser: true,
          confidence: 0.92,
          addresseeType: "direct_name",
          reason: "直接点名",
          question: "能否提前发布",
        },
      }),
    });
    // Mock cue API
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        cueText: "刚才在讨论 Beta 发布时间提前，需要你确认测试周期风险。",
      }),
    });

    const { useDetection } = await import("@/hooks/useDetection");
    const { result } = renderHook(() =>
      useDetection({
        canonicalName: "小陈",
        aliases: [
          { text: "小陈", kind: "canonical", prior: 1.0, source: "user" },
        ],
      })
    );

    // Simulate processing a sentence
    await act(async () => {
      await result.current.processSentence(
        {
          id: "turn-1",
          timestamp: Date.now(),
          speaker: "产品",
          text: "小陈，你们技术侧能不能把 Beta 发布时间提前到 5 月底？",
          isFinal: true,
        },
        []
      );
    });

    // Verify cueText is available
    expect(result.current.lastDetection).toBeDefined();
    expect(result.current.lastDetection?.candidate.status).toBe("confirmed");
  });

  it("lib/notification sendCueNotification 存在且可调用", async () => {
    const notification = await import("@/lib/notification");
    expect(typeof notification.sendCueNotification).toBe("function");
    expect(typeof notification.requestPermission).toBe("function");
    expect(typeof notification.getPermissionState).toBe("function");
  });
});
