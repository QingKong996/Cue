/**
 * Volcengine streaming ASR - real implementation.
 * Uses WebSocket to connect to Volcengine's bigmodel ASR endpoint.
 * Based on the official protocol: binary frames with gzip compression.
 */

import { randomUUID } from "node:crypto";
import zlib from "node:zlib";
import WebSocket from "ws";

export type ASRCallback = {
  onPartial: (text: string) => void;
  onFinal: (text: string) => void;
  onError: (error: Error) => void;
};

// ── Protocol constants ──

const HEADER_VERSION = 0x1;
const HEADER_SIZE = 0x1;
const MESSAGE_TYPE_FULL_CLIENT_REQUEST = 0x1;
const MESSAGE_TYPE_AUDIO_ONLY_REQUEST = 0x2;
const MESSAGE_TYPE_ERROR = 0xf;
const SERIALIZATION_NONE = 0x0;
const SERIALIZATION_JSON = 0x1;
const COMPRESSION_GZIP = 0x1;

const DEFAULT_ENDPOINT =
  "wss://openspeech.bytedance.com/api/v3/sauc/bigmodel_async";
const DEFAULT_RESOURCE_ID = "volc.seedasr.sauc.duration";

// ── Binary protocol helpers ──

function buildProtocolHeader(
  messageType: number,
  flags: number,
  serialization: number,
  compression: number,
): Buffer {
  return Buffer.from([
    (HEADER_VERSION << 4) | HEADER_SIZE,
    (messageType << 4) | flags,
    (serialization << 4) | compression,
    0x00,
  ]);
}

function buildClientMessage(
  messageType: number,
  flags: number,
  payload: Buffer,
  serialization: number,
): Buffer {
  const compressedPayload = zlib.gzipSync(payload);
  const header = buildProtocolHeader(
    messageType,
    flags,
    serialization,
    COMPRESSION_GZIP,
  );
  const size = Buffer.alloc(4);
  size.writeUInt32BE(compressedPayload.length, 0);
  return Buffer.concat([header, size, compressedPayload]);
}

function buildEmptyLastAudioMessage(): Buffer {
  const compressedPayload = zlib.gzipSync(Buffer.alloc(0));
  const header = buildProtocolHeader(
    MESSAGE_TYPE_AUDIO_ONLY_REQUEST,
    0x2,
    SERIALIZATION_NONE,
    COMPRESSION_GZIP,
  );
  const size = Buffer.alloc(4);
  size.writeUInt32BE(compressedPayload.length, 0);
  return Buffer.concat([header, size, compressedPayload]);
}

function parseServerMessage(message: Buffer): { flags: number; data: unknown } {
  if (message.length < 8) throw new Error("Invalid Volcengine response frame");

  const headerSize = (message[0] & 0x0f) * 4;
  const messageType = message[1] >> 4;
  const flags = message[1] & 0x0f;
  const serialization = message[2] >> 4;
  const compression = message[2] & 0x0f;
  let offset = headerSize;

  if (messageType === MESSAGE_TYPE_ERROR) {
    const code = message.readUInt32BE(offset);
    offset += 4;
    const payloadSize = message.readUInt32BE(offset);
    offset += 4;
    const payload = message.subarray(offset, offset + payloadSize);
    const text =
      compression === COMPRESSION_GZIP
        ? zlib.gunzipSync(payload).toString("utf8")
        : payload.toString("utf8");
    throw new Error(`Volcengine ASR error ${code}: ${text}`);
  }

  if (flags === 0x1 || flags === 0x3) offset += 4;
  const payloadSize = message.readUInt32BE(offset);
  offset += 4;
  const payload = message.subarray(offset, offset + payloadSize);
  const body =
    compression === COMPRESSION_GZIP
      ? zlib.gunzipSync(payload)
      : payload;

  return {
    flags,
    data:
      serialization === SERIALIZATION_JSON
        ? JSON.parse(body.toString("utf8"))
        : body,
  };
}

// ── Extract stable text from utterances ──

function getStableText(data: Record<string, unknown>): string {
  const result = data?.result as Record<string, unknown> | undefined;
  const utterances = Array.isArray(result?.utterances)
    ? (result.utterances as Array<Record<string, unknown>>)
    : [];
  return utterances
    .filter(
      (u) =>
        u &&
        u.definite &&
        typeof u.text === "string" &&
        (u.text as string).trim(),
    )
    .map((u) => u.text as string)
    .join("")
    .trim();
}

// ── Main entry ──

export function createVolcengineASR(callbacks: ASRCallback): {
  sendChunk: (chunk: ArrayBuffer) => void;
  close: () => void;
  ready: Promise<void>;
} {
  const appId = process.env.VOLCENGINE_APP_KEY ?? "";
  const accessToken = process.env.VOLCENGINE_ACCESS_KEY_ID ?? "";
  const endpoint = DEFAULT_ENDPOINT;
  const resourceId = DEFAULT_RESOURCE_ID;

  if (!appId || !accessToken) {
    throw new Error("VOLCENGINE_APP_KEY and VOLCENGINE_ACCESS_KEY_ID must be set");
  }

  let ws: WebSocket | null = null;
  let closed = false;
  let lastText = "";
  let sentLength = 0;
  let finalizedUpTo = 0;

  const ready = new Promise<void>((resolve, reject) => {
    ws = new WebSocket(endpoint, {
      headers: {
        "X-Api-App-Key": appId,
        "X-Api-Access-Key": accessToken,
        "X-Api-Resource-Id": resourceId,
        "X-Api-Connect-Id": randomUUID(),
      },
    });

    ws.binaryType = "arraybuffer";

    ws.on("open", () => {
      // Send initial config
      const config = JSON.stringify({
        user: {
          uid: "cue-user",
          did: "cue-server",
          platform: "node",
          sdk_version: "cue-1.0",
          app_version: "cue-prototype",
        },
        audio: {
          format: "pcm",
          codec: "raw",
          rate: 16000,
          bits: 16,
          channel: 1,
        },
        request: {
          model_name: "bigmodel",
          enable_itn: true,
          enable_punc: true,
          enable_ddc: false,
          result_type: "full",
          show_utterances: true,
          end_window_size: 800,
        },
      });

      const payload = Buffer.from(config, "utf8");
      ws?.send(
        buildClientMessage(
          MESSAGE_TYPE_FULL_CLIENT_REQUEST,
          0x0,
          payload,
          SERIALIZATION_JSON,
        ),
      );
    });

    ws.on("message", (data: Buffer | ArrayBuffer) => {
      try {
        const buf = Buffer.from(data as ArrayBuffer);
        const response = parseServerMessage(buf);
        const respData = response.data as Record<string, unknown>;
        const flags = response.flags;

        // Config ack or error with code
        if (respData?.code && (respData.code as number) !== 0) {
          callbacks.onError(
            new Error(
              `Volcengine ASR error ${respData.code}: ${JSON.stringify(respData)}`,
            ),
          );
          return;
        }

        const result = respData?.result as Record<string, unknown> | undefined;
        const text = typeof result?.text === "string" ? (result.text as string) : "";
        const utteranceText = getStableText(respData);

        // Final response (flags 0x2 or 0x3 = last packet)
        if (flags === 0x2 || flags === 0x3) {
          const finalText = utteranceText || text || lastText;
          const remaining = finalText.slice(finalizedUpTo).trim();
          if (remaining) {
            callbacks.onFinal(remaining);
          }
          finalizedUpTo = 0;
          lastText = "";
          return;
        }

        // Partial result: split on sentence-ending punctuation
        const displayText = utteranceText || text;
        if (displayText) {
          // Find last sentence boundary
          const sentenceEnders = /[。！？.!?\n]/g;
          let lastEnd = -1;
          let match: RegExpExecArray | null;
          while ((match = sentenceEnders.exec(displayText)) !== null) {
            lastEnd = match.index;
          }

          if (lastEnd >= 0 && lastEnd >= finalizedUpTo) {
            // New complete sentence(s) found
            const newFinal = displayText.slice(finalizedUpTo, lastEnd + 1).trim();
            if (newFinal) {
              callbacks.onFinal(newFinal);
            }
            finalizedUpTo = lastEnd + 1;

            // Remaining partial text after last boundary
            const remaining = displayText.slice(finalizedUpTo).trim();
            callbacks.onPartial(remaining);
          } else {
            // No new sentence boundary — show as partial
            const partial = displayText.slice(finalizedUpTo).trim();
            callbacks.onPartial(partial);
          }

          lastText = displayText;
        }
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : "Failed to parse ASR response";
        callbacks.onError(new Error(msg));
      }
    });

    ws.on("error", (err: Error) => {
      callbacks.onError(
        new Error(`Volcengine ASR WebSocket error: ${err.message}`),
      );
      reject(err);
    });

    ws.on("close", () => {
      ws = null;
    });

    // Resolve ready after a short delay for config ack
    // In practice, we resolve immediately and handle errors in the message handler
    setTimeout(resolve, 500);
  });

  function sendChunk(chunk: ArrayBuffer) {
    if (closed || !ws || ws.readyState !== WebSocket.OPEN) return;
    const payload = Buffer.from(chunk);
    ws.send(
      buildClientMessage(
        MESSAGE_TYPE_AUDIO_ONLY_REQUEST,
        0x0,
        payload,
        SERIALIZATION_NONE,
      ),
    );
  }

  function close() {
    if (closed) return;
    closed = true;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(buildEmptyLastAudioMessage());
      setTimeout(() => {
        ws?.close();
        ws = null;
      }, 1000);
    }
  }

  return { sendChunk, close, ready };
}
