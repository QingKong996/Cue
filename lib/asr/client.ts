"use client";

import type { TranscriptTurn } from "../types";

export type TranscriptCallback = {
  onPartial: (text: string) => void;
  onFinal: (turn: TranscriptTurn) => void;
  onError: (error: Error) => void;
  onStateChange: (
    state: "connecting" | "connected" | "disconnected" | "error",
  ) => void;
};

type ConnectionState =
  | "idle"
  | "connecting"
  | "connected"
  | "disconnected"
  | "error";

/**
 * Browser-side ASR client. Session-based:
 * 1. POST { action: "start" } → sessionId + SSE
 * 2. Batch audio chunks → POST { action: "chunk" }
 * 3. Read SSE for partial/final results
 */
export function createASRClient(callbacks: TranscriptCallback): {
  connect: () => void;
  sendChunk: (chunk: ArrayBuffer) => void;
  disconnect: () => void;
  getState: () => string;
} {
  let state: ConnectionState = "idle";
  let turnId = 0;
  let sessionId: string | null = null;
  let eventSource: EventSource | null = null;
  let abortController: AbortController | null = null;
  let batchTimer: ReturnType<typeof setInterval> | null = null;
  let pendingChunks: ArrayBuffer[] = [];
  // Buffer chunks while connecting
  let connectBuffer: ArrayBuffer[] = [];

  function setState(next: ConnectionState) {
    state = next;
    if (next !== "idle") {
      callbacks.onStateChange(next);
    }
  }

  function nextTurnId(): string {
    turnId++;
    return `turn-${turnId}`;
  }

  async function flushChunks() {
    if (!sessionId || pendingChunks.length === 0) return;

    const totalLength = pendingChunks.reduce(
      (sum, c) => sum + c.byteLength,
      0,
    );
    const merged = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of pendingChunks) {
      merged.set(new Uint8Array(chunk), offset);
      offset += chunk.byteLength;
    }
    pendingChunks = [];

    // base64 encode
    let binary = "";
    const step = 8192;
    for (let i = 0; i < merged.length; i += step) {
      const slice = merged.subarray(i, Math.min(i + step, merged.length));
      binary += String.fromCharCode(...slice);
    }
    const base64 = btoa(binary);

    try {
      await fetch("/api/asr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "chunk",
          sessionId,
          audio: base64,
        }),
      });
    } catch {
      // Non-fatal
    }
  }

  async function connect() {
    if (state === "connecting" || state === "connected") return;

    setState("connecting");
    abortController = new AbortController();

    try {
      const startRes = await fetch("/api/asr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start" }),
        signal: abortController.signal,
      });

      if (!startRes.ok) {
        const err = await startRes.json().catch(() => ({}));
        throw new Error(
          (err as { error?: string }).error ??
            `ASR start failed: ${startRes.status}`,
        );
      }

      const { sessionId: sid } = (await startRes.json()) as {
        sessionId: string;
      };
      sessionId = sid;

      // SSE for results
      eventSource = new EventSource(`/api/asr?sessionId=${sid}`);

      eventSource.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data) as {
            type: "partial" | "final" | "error";
            text: string;
          };

          if (msg.type === "partial") {
            callbacks.onPartial(msg.text);
          } else if (msg.type === "final") {
            callbacks.onFinal({
              id: nextTurnId(),
              timestamp: Date.now(),
              text: msg.text,
              isFinal: true,
            });
          } else if (msg.type === "error") {
            callbacks.onError(new Error(msg.text));
          }
        } catch {
          // Skip malformed
        }
      };

      eventSource.onerror = () => {
        // EventSource auto-reconnects; don't immediately error
      };

      // Flush connect buffer + start batch timer
      pendingChunks = [...connectBuffer, ...pendingChunks];
      connectBuffer = [];

      batchTimer = setInterval(() => {
        flushChunks();
      }, 400);

      setState("connected");
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "AbortError") {
        setState("disconnected");
        return;
      }
      const message =
        err instanceof Error ? err.message : "ASR connection failed";
      callbacks.onError(new Error(message));
      setState("error");
    }
  }

  function sendChunk(chunk: ArrayBuffer) {
    if (state === "connecting") {
      connectBuffer.push(chunk);
      return;
    }
    if (state !== "connected") return;
    pendingChunks.push(chunk);
  }

  async function disconnect() {
    if (batchTimer) {
      clearInterval(batchTimer);
      batchTimer = null;
    }

    await flushChunks();

    eventSource?.close();
    eventSource = null;
    abortController?.abort();
    abortController = null;
    pendingChunks = [];
    connectBuffer = [];

    if (sessionId) {
      try {
        await fetch("/api/asr", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "stop", sessionId }),
        });
      } catch {
        // Best-effort
      }
      sessionId = null;
    }

    setState("disconnected");
  }

  function getState(): string {
    return state;
  }

  return { connect, sendChunk, disconnect, getState };
}
