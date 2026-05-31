/**
 * ASR route handler — supports both streaming and non-streaming modes.
 *
 * POST with { mode: "http", audio: base64 } → non-streaming (default, Vercel-compatible)
 * POST with { action: "start" } → streaming session (requires long-running server)
 * POST with { action: "chunk", sessionId, audio: base64 } → streaming chunk
 * GET with ?sessionId=xxx → streaming SSE
 */

import { NextResponse } from "next/server";

// ── Non-streaming mode (default) ──

async function handleHTTP(audio: string) {
  try {
    const { recognizeAudio } = await import(
      "../../../lib/asr/volcengine-http"
    );
    const bytes = Buffer.from(audio, "base64");
    const ab = new Uint8Array(bytes).buffer;
    const result = await recognizeAudio(ab);
    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "ASR failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// ── Streaming mode (session-based) ──

import { createVolcengineASR, type ASRCallback } from "@/lib/asr/volcengine";

const sessions = new Map<
  string,
  {
    asr: ReturnType<typeof createVolcengineASR>;
    results: Array<{ type: string; text: string }>;
    listeners: Array<(data: { type: string; text: string }) => void>;
  }
>();

async function handleStreamStart() {
  const sessionId = `asr-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const results: Array<{ type: string; text: string }> = [];
  const listeners: Array<(data: { type: string; text: string }) => void> = [];

  const callbacks: ASRCallback = {
    onPartial(text) {
      const msg = { type: "partial", text };
      results.push(msg);
      for (const fn of listeners) fn(msg);
    },
    onFinal(text) {
      const msg = { type: "final", text };
      results.push(msg);
      for (const fn of listeners) fn(msg);
    },
    onError(error) {
      const msg = { type: "error", text: error.message };
      results.push(msg);
      for (const fn of listeners) fn(msg);
    },
  };

  try {
    const asr = createVolcengineASR(callbacks);
    await asr.ready;
    sessions.set(sessionId, { asr, results, listeners });
    return NextResponse.json({ sessionId });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "ASR init failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

function handleStreamChunk(body: { sessionId: string; audio: string }) {
  const session = sessions.get(body.sessionId);
  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }
  const audioBuffer = Buffer.from(body.audio, "base64");
  session.asr.sendChunk(audioBuffer.buffer);
  return NextResponse.json({ ok: true });
}

function handleStreamStop(body: { sessionId: string }) {
  const session = sessions.get(body.sessionId);
  if (session) {
    session.asr.close();
    sessions.delete(body.sessionId);
  }
  return NextResponse.json({ ok: true });
}

function handleStreamSSE(sessionId: string, signal: AbortSignal) {
  const session = sessions.get(sessionId);
  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      for (const result of session.results) {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(result)}\n\n`),
        );
      }

      const listener = (data: { type: string; text: string }) => {
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(data)}\n\n`),
          );
        } catch {
          // Stream closed
        }
      };
      session.listeners.push(listener);

      const ping = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": keepalive\n\n"));
        } catch {
          clearInterval(ping);
        }
      }, 15000);

      signal.addEventListener("abort", () => {
        clearInterval(ping);
        session.listeners = session.listeners.filter((l) => l !== listener);
      });
    },
  });

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

// ── Route handlers ──

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Non-streaming mode (default)
    if (body.mode === "http" || (!body.action && body.audio)) {
      return handleHTTP(body.audio);
    }

    // Streaming mode
    if (body.action === "start") return handleStreamStart();
    if (body.action === "chunk") return handleStreamChunk(body);
    if (body.action === "stop") return handleStreamStop(body);

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const sessionId = url.searchParams.get("sessionId");
  if (!sessionId) {
    return NextResponse.json(
      { error: "Missing sessionId" },
      { status: 400 },
    );
  }
  return handleStreamSSE(sessionId, request.signal);
}
