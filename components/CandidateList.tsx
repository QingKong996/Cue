"use client";

import { ScrollShadow, Spinner, Typography } from "@heroui/react";
import type { Candidate } from "@/lib/types";
import { CandidateCard } from "./CandidateCard";

export function CandidateList({
  candidates,
  isProcessing,
}: {
  candidates: Candidate[];
  isProcessing?: boolean;
}) {
  if (candidates.length === 0 && !isProcessing) {
    return (
      <div className="flex items-center justify-center h-full">
        <Typography.Paragraph size="sm" className="text-default-500">
          暂无候选
        </Typography.Paragraph>
      </div>
    );
  }

  return (
    <ScrollShadow
      orientation="vertical"
      className="flex flex-col gap-3 min-h-0 overflow-y-auto h-full"
    >
      {candidates.map((candidate) => (
        <CandidateCard key={candidate.id} candidate={candidate} />
      ))}
      {isProcessing && (
        <div className="flex items-center gap-2 px-3 py-2">
          <Spinner size="sm" />
          <Typography.Paragraph size="sm" className="text-default-400">
            分析中...
          </Typography.Paragraph>
        </div>
      )}
    </ScrollShadow>
  );
}
