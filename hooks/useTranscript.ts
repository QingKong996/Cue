"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createASRClient } from "../lib/asr/client";
import type { TranscriptTurn } from "../lib/types";

export type UseTranscriptReturn = {
  turns: TranscriptTurn[];
  latestTurn: TranscriptTurn | null;
  partialText: string;
  isConnected: boolean;
  startTranscription: () => void;
  stopTranscription: () => void;
  feedChunk: (chunk: ArrayBuffer) => void;
};

/**
 * Manages ASR client lifecycle, accumulates final turns,
 * and tracks partial (in-progress) text.
 */
export function useTranscript(): UseTranscriptReturn {
  const [turns, setTurns] = useState<TranscriptTurn[]>([]);
  const [partialText, setPartialText] = useState("");
  const [isConnected, setIsConnected] = useState(false);

  const clientRef = useRef<ReturnType<typeof createASRClient> | null>(null);
  const turnsRef = useRef(turns);
  turnsRef.current = turns;

  const startTranscription = useCallback(() => {
    if (clientRef.current) return;

    const client = createASRClient(
      {
        onPartial(text) {
          setPartialText(text);
        },
        onFinal(turn) {
          setPartialText("");
          setTurns((prev) => [...prev, turn]);
        },
        onError(error) {
          console.error("[useTranscript] ASR error:", error.message);
        },
        onStateChange(state) {
          setIsConnected(state === "connected");
        },
      },
      "http",
    );

    clientRef.current = client;
    client.connect();
  }, []);

  const stopTranscription = useCallback(() => {
    clientRef.current?.disconnect();
    clientRef.current = null;
    setIsConnected(false);
    setPartialText("");
  }, []);

  const feedChunk = useCallback((chunk: ArrayBuffer) => {
    clientRef.current?.sendChunk(chunk);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clientRef.current?.disconnect();
      clientRef.current = null;
    };
  }, []);

  const latestTurn = turns.length > 0 ? turns[turns.length - 1] : null;

  return {
    turns,
    latestTurn,
    partialText,
    isConnected,
    startTranscription,
    stopTranscription,
    feedChunk,
  };
}
