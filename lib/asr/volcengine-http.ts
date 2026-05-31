/**
 * Volcengine non-streaming ASR — one-shot recognition via WebSocket.
 * Opens a WebSocket, sends all audio at once, collects result, closes.
 */

import { createVolcengineASR } from "./volcengine";

export type ASRResult = {
  text: string;
  utterances?: Array<{ text: string; definite: boolean }>;
};

export async function recognizeAudio(
  audioBuffer: ArrayBuffer,
): Promise<ASRResult> {
  console.log(`[ASR WS] Starting, ${audioBuffer.byteLength} bytes`);

  return new Promise<ASRResult>((resolve, reject) => {
    const parts: string[] = [];
    let settled = false;

    function settle(text: string) {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      console.log(`[ASR WS] Settled: "${text}"`);
      resolve({ text });
    }

    const timeout = setTimeout(() => {
      settle(parts.join(""));
    }, 7_000);

    const asr = createVolcengineASR({
      onPartial() {},
      onFinal(text) {
        console.log(`[ASR WS] Final: "${text}"`);
        if (text.trim()) parts.push(text.trim());
        // Got a result — wait briefly for any remaining, then settle
        setTimeout(() => settle(parts.join("")), 500);
      },
      onError(error) {
        console.error(`[ASR WS] Error: ${error.message}`);
        if (!settled) {
          settled = true;
          clearTimeout(timeout);
          reject(error);
        }
      },
    });

    asr.ready
      .then(() => {
        console.log(`[ASR WS] Ready, sending ${audioBuffer.byteLength} bytes`);
        asr.sendChunk(audioBuffer);
        console.log(`[ASR WS] Sending end-of-audio`);
        asr.close();
      })
      .catch((err) => {
        console.error(`[ASR WS] Ready failed: ${err}`);
        if (!settled) {
          settled = true;
          clearTimeout(timeout);
          reject(err);
        }
      });
  });
}
