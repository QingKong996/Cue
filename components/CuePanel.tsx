"use client";

import type { TranscriptTurn, Candidate, AppState } from "@/lib/types";
import { Typography } from "@heroui/react";
import { TranscriptView } from "./TranscriptView";
import { CandidateList } from "./CandidateList";
import { CueFrameView } from "./CueFrameView";
import { CueDisplay } from "./CueDisplay";

type CuePanelProps = {
  transcriptTurns: TranscriptTurn[];
  partialText: string;
  candidates: Candidate[];
  cueFrameDisplayText: string;
  cueText: string | null;
  cueVisible: boolean;
  onCloseCue: () => void;
  appState: AppState;
  isProcessing?: boolean;
  isCueFrameUpdating?: boolean;
  error?: string | null;
};

export function CuePanel({
  transcriptTurns,
  partialText,
  candidates,
  cueFrameDisplayText,
  cueText,
  cueVisible,
  onCloseCue,
  appState,
  isProcessing,
  isCueFrameUpdating,
  error,
  className,
}: CuePanelProps & { className?: string }) {
  return (
    <div className={["flex flex-col flex-1 min-h-0", className].filter(Boolean).join(" ")}>
      <div className="grid grid-cols-[minmax(0,1.08fr)_minmax(380px,0.92fr)] gap-4 flex-1 min-h-0 lg:grid-cols-1">
        <section aria-label="会议转写" className="min-w-0">
          <TranscriptView turns={transcriptTurns} partialText={partialText} />
        </section>

        <aside
          aria-label="候选判定与 CueFrame"
          className="min-w-0 grid grid-rows-[286px_minmax(260px,1fr)] gap-4 lg:grid-rows-[372px_auto]"
        >
          <section aria-label="候选被 call 判定">
            <CandidateList candidates={candidates} isProcessing={isProcessing} />
          </section>

          <section aria-label="CueFrame">
            <CueFrameView displayText={cueFrameDisplayText} isUpdating={isCueFrameUpdating} />
          </section>
        </aside>
      </div>

      <CueDisplay
        cueText={cueText}
        visible={cueVisible}
        onClose={onCloseCue}
      />

      {error && (
        <div className="fixed top-4 right-4 z-50 max-w-sm bg-danger-soft border border-danger/40 rounded-lg px-4 py-3 shadow-md">
          <Typography.Paragraph size="sm" className="text-danger">
            {error}
          </Typography.Paragraph>
        </div>
      )}
    </div>
  );
}
