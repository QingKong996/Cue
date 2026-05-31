/**
 * Volcengine non-streaming ASR — one-shot recognition via WebSocket.
 * Opens a WebSocket, sends all audio at once, collects result, closes.
 * Compatible with Vercel serverless (within timeout limits).
 */

import { createVolcengineASR } from "./volcengine";

export type ASRResult = {
  text: string;
  utterances?: Array<{ text: string; definite: boolean }>;
};

/**
 * Recognize a complete audio buffer using Volcengine's WebSocket ASR.
 * Audio should be 16kHz mono 16-bit PCM.
 */
export async function recognizeAudio(
  audioBuffer: ArrayBuffer,
): Promise<ASRResult> {
  return new Promise<ASRResult>((resolve, reject) => {
    const parts: string[] = [];
    let settled = false;

    const timeout = setTimeout(() => {
      if (!settled) {
        settled = true;
        asr.close();
        resolve({ text: parts.join("") });
      }
    }, 14_000);

    function settle() {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      resolve({ text: parts.join("") });
    }

    const asr = createVolcengineASR({
      onPartial() {},
      onFinal(text) {
        if (text.trim()) parts.push(text.trim());
      },
      onError(error) {
        if (!settled) {
          settled = true;
          clearTimeout(timeout);
          reject(error);
        }
      },
    });

    asr.ready
      .then(() => {
        asr.sendChunk(audioBuffer);
        asr.close();
        // Close sends end-of-audio signal then closes WS after 1s
        // Give extra time for server to return final result
        setTimeout(settle, 3000);
      })
      .catch((err) => {
        if (!settled) {
          settled = true;
          clearTimeout(timeout);
          reject(err);
        }
      });
  });
}
