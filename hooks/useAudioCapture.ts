"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AudioSource } from "../lib/types";
import { createMicStream, createScreenStream, stopStream } from "../lib/audio/capture";
import { createAudioProcessor, type AudioProcessor } from "../lib/audio/processor";

export type AudioCaptureState = "idle" | "requesting" | "active" | "error";

export type UseAudioCapture = {
  state: AudioCaptureState;
  error: string | null;
  start: (source: AudioSource) => Promise<void>;
  stop: () => void;
};

/**
 * Hook to manage the full audio capture lifecycle:
 * stream acquisition -> PCM processing -> chunk delivery via callback.
 */
export function useAudioCapture(
  onChunk?: (chunk: ArrayBuffer) => void,
): UseAudioCapture {
  const [state, setState] = useState<AudioCaptureState>("idle");
  const [error, setError] = useState<string | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<AudioProcessor | null>(null);
  const onChunkRef = useRef(onChunk);
  onChunkRef.current = onChunk;

  const cleanup = useCallback(() => {
    processorRef.current?.stop();
    processorRef.current = null;
    if (streamRef.current) {
      stopStream(streamRef.current);
      streamRef.current = null;
    }
  }, []);

  const stop = useCallback(() => {
    cleanup();
    setState("idle");
    setError(null);
  }, [cleanup]);

  const start = useCallback(
    async (source: AudioSource) => {
      // Stop any existing capture first
      cleanup();
      setState("requesting");
      setError(null);

      try {
        const stream =
          source === "mic" ? await createMicStream() : await createScreenStream();
        streamRef.current = stream;

        // If the user ends the shared tab / revokes permission mid-session
        stream.getTracks().forEach((track) => {
          track.onended = () => stop();
        });

        const processor = createAudioProcessor(stream, (chunk) => {
          onChunkRef.current?.(chunk);
        });
        processor.start();
        processorRef.current = processor;

        setState("active");
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "音频捕获失败";
        setError(message);
        setState("error");
        cleanup();
      }
    },
    [cleanup, stop],
  );

  // Clean up on unmount
  useEffect(() => {
    return () => cleanup();
  }, [cleanup]);

  return { state, error, start, stop };
}
