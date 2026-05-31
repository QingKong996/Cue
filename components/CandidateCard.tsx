"use client";

import { Chip, Surface, TextArea, Typography, cn } from "@heroui/react";
import type { Candidate, CandidateStatus } from "@/lib/types";

const statusCopy: Record<CandidateStatus, string> = {
  rejected: "静默",
  watching: "候选",
  confirmed: "触发",
};

const statusColorMap: Record<CandidateStatus, "success" | "warning" | "danger"> = {
  confirmed: "success",
  watching: "warning",
  rejected: "danger",
};

const statusBorderClass: Record<CandidateStatus, string> = {
  confirmed: "border-success/54 bg-success-soft",
  watching: "border-warning/54 bg-warning-soft",
  rejected: "border-danger/54 bg-danger-soft",
};

export function CandidateCard({ candidate }: { candidate: Candidate }) {
  return (
    <Surface
      variant="default"
      className={cn(
        "flex-none min-h-[86px] rounded-lg border sm:min-h-[104px]",
        statusBorderClass[candidate.status]
      )}
    >
      <div className="grid grid-cols-[92px_minmax(0,1fr)_60px] items-center h-full gap-2.5 p-3 sm:grid-cols-[72px_minmax(0,1fr)_52px] sm:gap-2">
        <div className="flex flex-col gap-2 min-w-0">
          <Typography.Paragraph size="sm" className="text-default-500">
            {candidate.label}
          </Typography.Paragraph>
          <Typography.Paragraph size="sm" className="text-default-500">
            {statusCopy[candidate.status]}
          </Typography.Paragraph>
        </div>
        <TextArea
          readOnly
          rows={2}
          value={candidate.text}
          aria-label={`${candidate.label} ${statusCopy[candidate.status]}`}
        />
        <Chip
          size="sm"
          variant="soft"
          color={statusColorMap[candidate.status]}
          className="min-w-[54px] justify-center"
        >
          {candidate.confidence}%
        </Chip>
      </div>
    </Surface>
  );
}
