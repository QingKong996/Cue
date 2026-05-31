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
 * Browser-side ASR client with two modes:
 *
 * - "http" (default): batches audio chunks, sends as single POST, gets text back.
 *   Vercel-compatible, ~3s latency per chunk.
 *
 * - "stream": session-based WebSocket bridge, real-time partial+final results.
 *   Requires long-running server.
 */
export function createASRClient(
  callbacks: TranscriptCallback,
  mode: "http" | "stream" = "http",
): {
  connect: () => void;
  sendChunk: (chunk: ArrayBuffer) => void;
  disconnect: () => void;
  getState: () => string;
} {
  if (mode === "stream") {
    return createStreamClient(callbacks);
  }
  return createHTTPClient(callbacks);
}

// ── HTTP mode (non-streaming, default) ──

function createHTTPClient(callbacks: TranscriptCallback) {
  let state: ConnectionState = "idle";
  let turnId = 0;
  let batchTimer: ReturnType<typeof setInterval> | null = null;
  let pendingChunks: ArrayBuffer[] = [];
  let flushing = false;

  function setState(next: ConnectionState) {
    state = next;
    if (next !== "idle") callbacks.onStateChange(next);
  }

  function nextTurnId(): string {
    return `turn-${++turnId}`;
  }

  async function flushChunks() {
    if (flushing || pendingChunks.length === 0) return;
    flushing = true;

    // Merge chunks
    const totalLength = pendingChunks.reduce((s, c) => s + c.byteLength, 0);
    const merged = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of pendingChunks) {
      merged.set(new Uint8Array(chunk), offset);
      offset += chunk.byteLength;
    }
    pendingChunks = [];

    console.log(`[ASR] Sending ${merged.length} bytes of audio`);

    // base64
    let binary = "";
    const step = 8192;
    for (let i = 0; i < merged.length; i += step) {
      const slice = merged.subarray(i, Math.min(i + step, merged.length));
      binary += String.fromCharCode(...slice);
    }
    const audio = btoa(binary);
    console.log(`[ASR] Sending ${merged.length} bytes, base64: ${audio.length} chars`);

    try {
      const res = await fetch("/api/asr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "http", audio }),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        console.error(`[ASR] HTTP ${res.status}: ${errText}`);
        callbacks.onError(new Error(errText || `ASR failed: ${res.status}`));
        return;
      }

      const data = (await res.json()) as {
        text: string;
        utterances?: Array<{ text: string; definite: boolean }>;
      };

      if (data.text) {
        // Split by sentence-ending punctuation
        const sentences = data.text.split(/(?<=[。！？.!?\n])/g).filter(Boolean);
        for (const sentence of sentences) {
          if (sentence.trim()) {
            callbacks.onFinal({
              id: nextTurnId(),
              timestamp: Date.now(),
              text: sentence.trim(),
              isFinal: true,
            });
          }
        }
        if (sentences.length === 0 && data.text.trim()) {
          // No sentence boundary — show as partial, will become final on next batch
          callbacks.onPartial(data.text.trim());
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "ASR request failed";
      console.error(`[ASR] Fetch error: ${msg}`, err);
      callbacks.onError(new Error(msg));
    } finally {
      flushing = false;
    }
  }

  function connect() {
    if (state === "connecting" || state === "connected") return;
    setState("connecting");
    // HTTP mode is always "connected" — no persistent connection needed
    batchTimer = setInterval(flushChunks, 5000);
    setState("connected");
  }

  function sendChunk(chunk: ArrayBuffer) {
    if (state !== "connected") return;
    pendingChunks.push(chunk);
    console.log(`[ASR] Chunk received: ${chunk.byteLength} bytes, pending: ${pendingChunks.length}`);
  }

  function disconnect() {
    if (batchTimer) {
      clearInterval(batchTimer);
      batchTimer = null;
    }
    // Flush remaining
    flushChunks();
    pendingChunks = [];
    setState("disconnected");
  }

  function getState() {
    return state;
  }

  return { connect, sendChunk, disconnect, getState };
}

// ── Stream mode (WebSocket bridge) ──

function createStreamClient(callbacks: TranscriptCallback) {
  let state: ConnectionState = "idle";
  let turnId = 0;
  let sessionId: string | null = null;
  let eventSource: EventSource | null = null;
  let abortController: AbortController | null = null;
  let batchTimer: ReturnType<typeof setInterval> | null = null;
  let pendingChunks: ArrayBuffer[] = [];
  let connectBuffer: ArrayBuffer[] = [];

  function setState(next: ConnectionState) {
    state = next;
    if (next !== "idle") callbacks.onStateChange(next);
  }

  function nextTurnId() {
    return `turn-${++turnId}`;
  }

  async function flushChunks() {
    if (!sessionId || pendingChunks.length === 0) return;

    const totalLength = pendingChunks.reduce((s, c) => s + c.byteLength, 0);
    const merged = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of pendingChunks) {
      merged.set(new Uint8Array(chunk), offset);
      offset += chunk.byteLength;
    }
    pendingChunks = [];

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
        body: JSON.stringify({ action: "chunk", sessionId, audio: base64 }),
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
          (err as { error?: string }).error ?? `ASR start failed: ${startRes.status}`,
        );
      }

      const { sessionId: sid } = (await startRes.json()) as {
        sessionId: string;
      };
      sessionId = sid;

      eventSource = new EventSource(`/api/asr?sessionId=${sid}`);

      eventSource.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data) as {
            type: "partial" | "final" | "error";
            text: string;
          };
          if (msg.type === "partial") callbacks.onPartial(msg.text);
          else if (msg.type === "final")
            callbacks.onFinal({
              id: nextTurnId(),
              timestamp: Date.now(),
              text: msg.text,
              isFinal: true,
            });
          else if (msg.type === "error") callbacks.onError(new Error(msg.text));
        } catch {
          // Skip malformed
        }
      };

      eventSource.onerror = () => {};

      pendingChunks = [...connectBuffer, ...pendingChunks];
      connectBuffer = [];
      batchTimer = setInterval(flushChunks, 400);
      setState("connected");
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        setState("disconnected");
        return;
      }
      const msg = err instanceof Error ? err.message : "ASR connection failed";
      callbacks.onError(new Error(msg));
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
      } catch {}
      sessionId = null;
    }
    setState("disconnected");
  }

  function getState() {
    return state;
  }

  return { connect, sendChunk, disconnect, getState };
}
