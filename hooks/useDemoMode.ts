"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { TranscriptTurn } from "@/lib/types";

const MOCK_PHRASES = [
  "大家好，今天我们讨论一下项目进度。",
  "前端的交互原型已经完成了初版。",
  "后端 API 需要在下周三之前对接完。",
  "测试环境的部署方案需要确认一下。",
  "数据迁移的脚本已经写好了，等一下可以跑一下看看。",
  "关于性能优化，建议先从数据库查询入手。",
  "用户的反馈主要集中在加载速度上。",
  "新的设计稿已经发到群里了。",
  "安全审计的结果下周会出来。",
  "跨平台兼容性测试通过了大部分用例。",
  "小陈，这个接口你那边能提前联调吗？",
  "小陈，技术方案你来定一下。",
  "后端同学觉得这个排期可行吗？",
];

const SPEAKERS = ["产品", "运营", "设计", "测试", "PM"];

const DEMO_INTERVAL_MS = 2500;

export function useDemoMode(onTurn: (turn: TranscriptTurn) => void) {
  const [isActive, setIsActive] = useState(false);
  const indexRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onTurnRef = useRef(onTurn);
  onTurnRef.current = onTurn;

  const stop = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setIsActive(false);
  }, []);

  const start = useCallback(() => {
    if (timerRef.current) return;
    setIsActive(true);
    indexRef.current = 0;

    // First turn immediately
    const firstPhrase = MOCK_PHRASES[0];
    indexRef.current = 1;
    onTurnRef.current({
      id: `demo-0`,
      timestamp: Date.now(),
      speaker: SPEAKERS[0 % SPEAKERS.length],
      text: firstPhrase,
      isFinal: true,
    });

    timerRef.current = setInterval(() => {
      const idx = indexRef.current % MOCK_PHRASES.length;
      const phrase = MOCK_PHRASES[idx];
      const turn: TranscriptTurn = {
        id: `demo-${indexRef.current}`,
        timestamp: Date.now(),
        speaker: SPEAKERS[idx % SPEAKERS.length],
        text: phrase,
        isFinal: true,
      };
      indexRef.current++;
      onTurnRef.current(turn);
    }, DEMO_INTERVAL_MS);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  return { isActive, start, stop };
}
