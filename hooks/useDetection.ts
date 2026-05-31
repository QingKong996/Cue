"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  Candidate,
  CueFrame,
  DetectionResult,
  TranscriptTurn,
  UserProfile,
} from "@/lib/types";
import { recallCandidates } from "@/lib/detection/recall";
import { judgeSemantic } from "@/lib/detection/semantic";
import { fuseConfidence } from "@/lib/detection/confidence";
import { createDecisionMaker } from "@/lib/detection/decision";
import { CUE_GENERATION_TIMEOUT_MS } from "@/lib/constants";

export function useDetection(profile: UserProfile | null): {
  candidates: Candidate[];
  lastDetection: DetectionResult | null;
  isProcessing: boolean;
  error: string | null;
  cueText: string | null;
  processSentence: (
    turn: TranscriptTurn,
    context: TranscriptTurn[],
    cueFrame?: CueFrame | null,
  ) => Promise<void>;
} {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [lastDetection, setLastDetection] = useState<DetectionResult | null>(
    null,
  );
  const [cueText, setCueText] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const processedIds = useRef<Set<string>>(new Set());
  const decisionMaker = useRef(createDecisionMaker());

  // Tick interval to expire old candidates
  useEffect(() => {
    const interval = setInterval(() => {
      decisionMaker.current.tick();
      const state = decisionMaker.current.getState();
      setCandidates(Array.from(state.activeCandidates.values()));
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const processSentence = useCallback(
    async (
      turn: TranscriptTurn,
      context: TranscriptTurn[],
      cueFrame?: CueFrame | null,
    ) => {
      if (!profile) return;
      if (processedIds.current.has(turn.id)) return;
      processedIds.current.add(turn.id);

      setIsProcessing(true);
      setError(null);
      try {
        // Step 1: local recall (instant)
        const hits = recallCandidates(turn.text, profile.aliases);
        if (hits.length === 0) {
          // No hits — silent rejection, skip LLM
          const result = decisionMaker.current.decide(turn.text, 0, {
            addressedToUser: false,
            confidence: 0,
            addresseeType: "not_user",
            reason: "无命中",
            question: null,
          });
          if (result) {
            const state = decisionMaker.current.getState();
            setCandidates(Array.from(state.activeCandidates.values()));
          }
          return;
        }

        // Step 2: semantic judgment via LLM
        const decision = await judgeSemantic(turn.text, context, profile);

        // Step 3: fuse confidence
        const fusedConfidence = fuseConfidence(hits, decision);

        // Step 4: decision
        const result = decisionMaker.current.decide(
          turn.text,
          fusedConfidence,
          decision,
        );

        if (result) {
          const state = decisionMaker.current.getState();
          setCandidates(Array.from(state.activeCandidates.values()));

          if (result.action === "show") {
            // Step 5: generate Cue text
            let generatedCueText: string | null = null;
            try {
              const controller = new AbortController();
              const timeout = setTimeout(
                () => controller.abort(),
                CUE_GENERATION_TIMEOUT_MS,
              );

              const response = await fetch("/api/llm/cue", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  cueFrame: cueFrame ?? null,
                  currentSentence: turn.text,
                  recentTurns: context,
                }),
                signal: controller.signal,
              });

              clearTimeout(timeout);

              if (response.ok) {
                const data = await response.json();
                generatedCueText = data.cueText ?? null;
              }
            } catch {
              // Timeout or network error — use fallback
            }

            if (!generatedCueText) {
              generatedCueText = cueFrame
                ? `${cueFrame.macroTopic}：请注意回应。`
                : "有人在叫你，请注意回应。";
            }

            setCueText(generatedCueText);
            setLastDetection({ ...result, cueText: generatedCueText });
          } else {
            setLastDetection(result);
          }
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "检测处理失败";
        setError(message);
      } finally {
        setIsProcessing(false);
      }
    },
    [profile],
  );

  return { candidates, lastDetection, isProcessing, error, cueText, processSentence };
}
