import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { render, screen } from "@testing-library/react";
import type { TranscriptTurn, UserProfile, CueFrame } from "@/lib/types";

// Mock framer-motion to avoid jsdom issues
vi.mock("framer-motion", () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
  motion: {
    div: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => {
      const { initial, animate, exit, transition, ...rest } = props;
      return <div {...rest}>{children}</div>;
    },
  },
}));

// Mock @heroui/react for component tests
vi.mock("@heroui/react", async () => {
  const React = await import("react");
  const Card = Object.assign(
    ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => React.createElement("div", props, children),
    {
      Header: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => React.createElement("div", props, children),
      Content: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => React.createElement("div", props, children),
    }
  );
  return {
    Card,
    Chip: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => React.createElement("span", props, children),
    Typography: {
      Paragraph: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => React.createElement("p", props, children),
      Heading: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => React.createElement("h2", props, children),
    },
    cn: (...args: unknown[]) => args.filter(Boolean).join(" "),
  };
});

const mockFetch = vi.fn() as Mock;
vi.stubGlobal("fetch", mockFetch);

const profile: UserProfile = {
  canonicalName: "小陈",
  aliases: [{ text: "小陈", kind: "canonical", prior: 1.0, source: "user" }],
};

const mockTurns: TranscriptTurn[] = [
  { id: "t1", timestamp: 1000, speaker: "产品", text: "Q3 目标是 Beta 发布", isFinal: true },
  { id: "t2", timestamp: 2000, speaker: "运营", text: "需要确认技术风险", isFinal: true },
  { id: "t3", timestamp: 3000, speaker: "产品", text: "小陈，你们技术侧怎么看？", isFinal: true },
];

describe("端到端管线集成", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it("useTranscript 管理转写状态", async () => {
    const { useTranscript } = await import("@/hooks/useTranscript");
    const { result } = renderHook(() => useTranscript());

    expect(result.current.turns).toEqual([]);
    expect(result.current.latestTurn).toBeNull();
    expect(result.current.partialText).toBe("");
    expect(result.current.isConnected).toBe(false);
  });

  it("useCueFrame 管理 CueFrame 状态", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        cueFrame: {
          version: 1,
          timeframe: "过去约 1 分钟",
          macroTopic: "Beta 发布",
          currentQuestion: null,
          recentDecisions: [],
          openIssues: [],
          userRelevantFacts: [],
          likelyQuestionsToUser: [],
          suggestedAnswerAngles: [],
          sourceTurnIds: ["t1"],
          updatedAt: Date.now(),
        },
      }),
    });

    const { useCueFrame } = await import("@/hooks/useCueFrame");
    const { result } = renderHook(() => useCueFrame(null, profile));

    expect(result.current.cueFrame).toBeNull();
    expect(result.current.isUpdating).toBe(false);
    expect(typeof result.current.forceUpdate).toBe("function");
  });

  it("lib/context/transcript 管理器正确添加和检索转写", async () => {
    const { createTranscriptManager } = await import("@/lib/context/transcript");
    const manager = createTranscriptManager();

    expect(manager.size()).toBe(0);

    manager.addTurn(mockTurns[0]);
    manager.addTurn(mockTurns[1]);
    expect(manager.size()).toBe(2);

    const recent = manager.getRecentTurns(1);
    expect(recent).toHaveLength(1);
    expect(recent[0].id).toBe("t2");
  });

  it("lib/context/cueframe 格式化展示", async () => {
    const frame: CueFrame = {
      version: 1,
      timeframe: "过去约 4 分钟",
      macroTopic: "Beta 发布时间",
      currentQuestion: "能否提前",
      recentDecisions: ["权限模块拆开上线"],
      openIssues: ["支付回调测试"],
      userRelevantFacts: ["技术侧负责"],
      likelyQuestionsToUser: ["能否压缩测试周期"],
      suggestedAnswerAngles: ["区分模块"],
      sourceTurnIds: ["t1"],
      updatedAt: Date.now(),
    };

    const { createCueFrameManager } = await import("@/lib/context/cueframe");
    const manager = createCueFrameManager();

    const display = manager.formatForDisplay(frame);
    expect(display).toContain("时间范围：过去约 4 分钟");
    expect(display).toContain("宏观话题：Beta 发布时间");
    expect(display).toContain("可回应角度：区分模块");
  });

  it("lib/detection/recall 正确召回候选", async () => {
    const { recallCandidates } = await import("@/lib/detection/recall");
    const aliases = [
      { text: "小陈", kind: "canonical" as const, prior: 1.0, source: "user" as const },
    ];

    const hits = recallCandidates("小陈，你们技术侧怎么看？", aliases);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].alias.text).toBe("小陈");
  });

  it("lib/detection/confidence 融合置信度", async () => {
    const { fuseConfidence } = await import("@/lib/detection/confidence");
    const hits = [
      {
        alias: { text: "小陈", kind: "canonical" as const, prior: 1.0, source: "user" as const },
        matchedText: "小陈",
        hitType: "exact_name" as const,
        position: 0,
      },
    ];
    const decision = {
      addressedToUser: true,
      confidence: 0.9,
      addresseeType: "direct_name" as const,
      reason: "直接点名",
      question: "怎么看",
    };

    const score = fuseConfidence(hits, decision);
    expect(score).toBeGreaterThanOrEqual(0.78); // Should be above SHOW threshold
  });

  it("lib/detection/decision 决策器正确判断", async () => {
    const { createDecisionMaker } = await import("@/lib/detection/decision");
    const dm = createDecisionMaker();

    // High confidence → show
    const result1 = dm.decide("小陈你怎么看", 0.9, {
      addressedToUser: true,
      confidence: 0.9,
      addresseeType: "direct_name",
      reason: "直接点名",
      question: "你怎么看",
    });
    expect(result1).not.toBeNull();
    expect(result1!.action).toBe("show");
    expect(result1!.candidate.status).toBe("confirmed");

    // Low confidence → silent
    const result2 = dm.decide("这个方案不错", 0.1, {
      addressedToUser: false,
      confidence: 0.1,
      addresseeType: "not_user",
      reason: "无关",
      question: null,
    });
    expect(result2).not.toBeNull();
    expect(result2!.action).toBe("silent");
    expect(result2!.candidate.status).toBe("rejected");
  });
});

describe("Demo 模式", () => {
  it("useDemoMode 产生转写 turns", async () => {
    vi.useFakeTimers();
    const { useDemoMode } = await import("@/hooks/useDemoMode");
    const receivedTurns: TranscriptTurn[] = [];

    const { result } = renderHook(() =>
      useDemoMode((turn) => receivedTurns.push(turn)),
    );

    expect(result.current.isActive).toBe(false);

    act(() => {
      result.current.start();
    });

    expect(result.current.isActive).toBe(true);
    // First turn is sent immediately
    expect(receivedTurns.length).toBe(1);
    expect(receivedTurns[0].isFinal).toBe(true);
    expect(receivedTurns[0].text).toBeTruthy();

    // Advance timer to get more turns
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(receivedTurns.length).toBe(2);

    act(() => {
      result.current.stop();
    });
    expect(result.current.isActive).toBe(false);

    vi.useRealTimers();
  });
});

describe("CueDisplay 组件", () => {
  it("渲染 cueText 当 visible 为 true", async () => {
    vi.mock("@heroui/react", async () => {
      const React = await import("react");
      const Card = Object.assign(
        ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => React.createElement("div", props, children),
        {
          Header: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => React.createElement("div", props, children),
          Content: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => React.createElement("div", props, children),
        }
      );
      return {
        Card,
        Chip: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => React.createElement("span", props, children),
        Typography: {
          Paragraph: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => React.createElement("p", props, children),
          Heading: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => React.createElement("h2", props, children),
        },
        cn: (...args: unknown[]) => args.filter(Boolean).join(" "),
      };
    });
    const { CueDisplay } = await import("@/components/CueDisplay");
    render(
      <CueDisplay
        cueText="有人在叫你"
        visible={true}
        onClose={() => {}}
      />,
    );
    expect(screen.getByText("有人在叫你")).toBeInTheDocument();
  }, 10000);

  it("不渲染内容当 visible 为 false", async () => {
    const { CueDisplay } = await import("@/components/CueDisplay");
    const { container } = render(
      <CueDisplay
        cueText="有人在叫你"
        visible={false}
        onClose={() => {}}
      />,
    );
    expect(container.textContent).not.toContain("有人在叫你");
  }, 10000);
});

describe("StatusBar 组件", () => {
  it("显示正确的状态标签", async () => {
    const { StatusBar } = await import("@/components/StatusBar");

    const { rerender } = render(<StatusBar state="idle" />);
    expect(screen.getByText("空闲")).toBeInTheDocument();

    rerender(<StatusBar state="configuring" />);
    expect(screen.getByText("配置中")).toBeInTheDocument();

    rerender(<StatusBar state="listening" />);
    expect(screen.getByText("监听中")).toBeInTheDocument();

    rerender(<StatusBar state="paused" />);
    expect(screen.getByText("已暂停")).toBeInTheDocument();

    rerender(<StatusBar state="error" />);
    expect(screen.getByText("错误")).toBeInTheDocument();

    rerender(<StatusBar state="demo" />);
    expect(screen.getByText("演示中")).toBeInTheDocument();
  });

  it("显示自定义 message", async () => {
    const { StatusBar } = await import("@/components/StatusBar");
    render(<StatusBar state="error" message="连接断开" />);
    expect(screen.getByText("连接断开")).toBeInTheDocument();
  });
});

describe("notification.ts SSR 安全", () => {
  it("requestPermission 在无 Notification API 时返回 denied", async () => {
    const original = (globalThis as Record<string, unknown>).Notification;
    delete (globalThis as Record<string, unknown>).Notification;

    const { requestPermission } = await import("@/lib/notification");
    const result = await requestPermission();
    expect(result).toBe("denied");

    if (original) (globalThis as Record<string, unknown>).Notification = original;
  });

  it("getPermissionState 在无 Notification API 时返回 denied", async () => {
    const original = (globalThis as Record<string, unknown>).Notification;
    delete (globalThis as Record<string, unknown>).Notification;

    const { getPermissionState } = await import("@/lib/notification");
    expect(getPermissionState()).toBe("denied");

    if (original) (globalThis as Record<string, unknown>).Notification = original;
  });

  it("sendCueNotification 在无 Notification API 时不抛异常", async () => {
    const original = (globalThis as Record<string, unknown>).Notification;
    delete (globalThis as Record<string, unknown>).Notification;

    const { sendCueNotification } = await import("@/lib/notification");
    expect(() => sendCueNotification("test")).not.toThrow();

    if (original) (globalThis as Record<string, unknown>).Notification = original;
  });
});
