"use client";

import { useEffect, useRef } from "react";
import { TextArea, Typography } from "@heroui/react";
import type { TranscriptTurn } from "../lib/types";

type TranscriptViewProps = {
  /** Static string value — keeps current behavior for backward compatibility */
  value?: string;
  /** Live transcript turns */
  turns?: TranscriptTurn[];
  /** Partial (in-progress) text from ASR */
  partialText?: string;
};

function formatTimestamp(ts: number): string {
  const d = new Date(ts);
  const h = d.getHours().toString().padStart(2, "0");
  const m = d.getMinutes().toString().padStart(2, "0");
  const s = d.getSeconds().toString().padStart(2, "0");
  return `${h}:${m}:${s}`;
}

export function TranscriptView({
  value,
  turns,
  partialText,
}: TranscriptViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll when content changes
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [turns, partialText]);

  // Live transcript mode: render formatted turns
  if (turns !== undefined) {
    return (
      <label className="flex flex-col gap-2 w-full">
        <Typography.Paragraph size="sm" className="text-default-500">
          会议上下文
        </Typography.Paragraph>
        <div
          ref={scrollRef}
          className="border border-default-200 rounded-medium p-3 overflow-y-auto min-h-[calc(100vh-170px)] lg:min-h-[460px] bg-content1"
        >
          {turns.length === 0 && !partialText && (
            <p className="text-default-400 text-sm">等待转写结果...</p>
          )}

          {turns.map((turn) => (
            <div key={turn.id} className="mb-2">
              <span className="text-default-400 text-xs mr-2">
                {formatTimestamp(turn.timestamp)}
              </span>
              {turn.speaker && (
                <span className="text-primary text-xs font-medium mr-2">
                  {turn.speaker}
                </span>
              )}
              <span className="text-default-700 text-sm">{turn.text}</span>
            </div>
          ))}

          {partialText && (
            <div className="mb-2">
              <span className="text-default-400 text-xs mr-2">
                {formatTimestamp(Date.now())}
              </span>
              <span className="text-default-500 text-sm italic">
                {partialText}
              </span>
            </div>
          )}
        </div>
      </label>
    );
  }

  // Static mode (original behavior)
  return (
    <label className="flex flex-col gap-2 w-full">
      <Typography.Paragraph size="sm" className="text-default-500">
        会议上下文
      </Typography.Paragraph>
      <TextArea
        readOnly
        rows={20}
        value={value ?? ""}
        className="min-h-[calc(100vh-170px)] lg:min-h-[460px]"
      />
    </label>
  );
}
