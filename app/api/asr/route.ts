/**
 * ASR route handler — session-based approach.
 *
 * POST with { action: "start" } → creates Volcengine ASR session, returns sessionId
 * POST with { action: "chunk", sessionId, audio } → sends audio chunk
 * GET with ?sessionId=xxx → SSE stream of transcript results
 */

import { NextResponse } from "next/server";
import { createVolcengineASR, type ASRCallback } from "@/lib/asr/volcengine";

// In-memory session store
const sessions = new Map<
  string,
  {
    asr: ReturnType<typeof createVolcengineASR>;
    results: Array<{ type: string; text: string }>;
    listeners: Array<(data: { type: string; text: string }) => void>;
  }
>();

// ── POST: start session or send chunk ──

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (body.action === "start") {
      const sessionId = `asr-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      const results: Array<{ type: string; text: string }> = [];
      const listeners: Array<
        (data: { type: string; text: string }) => void
      > = [];

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

    if (body.action === "chunk") {
      const session = sessions.get(body.sessionId);
      if (!session) {
        return NextResponse.json(
          { error: "Session not found" },
          { status: 404 },
        );
      }
      // audio is base64-encoded ArrayBuffer
      const audioBuffer = Buffer.from(body.audio, "base64");
      session.asr.sendChunk(audioBuffer.buffer);
      return NextResponse.json({ ok: true });
    }

    if (body.action === "stop") {
      const session = sessions.get(body.sessionId);
      if (session) {
        session.asr.close();
        sessions.delete(body.sessionId);
      }
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// ── GET: SSE stream of results ──

export async function GET(request: Request) {
  const url = new URL(request.url);
  const sessionId = url.searchParams.get("sessionId");

  if (!sessionId || !sessions.has(sessionId)) {
    return NextResponse.json(
      { error: "Session not found" },
      { status: 404 },
    );
  }

  const session = sessions.get(sessionId)!;
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // Send existing results
      for (const result of session.results) {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(result)}\n\n`),
        );
      }

      // Listen for new results
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

      // Keep-alive ping every 15s
      const ping = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": keepalive\n\n"));
        } catch {
          clearInterval(ping);
        }
      }, 15000);

      // Cleanup when client disconnects
      request.signal.addEventListener("abort", () => {
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
