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
  console.log(`[ASR WS] Starting recognition, ${audioBuffer.byteLength} bytes`);

  return new Promise<ASRResult>((resolve, reject) => {
    const parts: string[] = [];
    let settled = false;

    const timeout = setTimeout(() => {
      console.log(`[ASR WS] Timeout, collected: ${parts.join("")}`);
      if (!settled) {
        settled = true;
        asr.close();
        resolve({ text: parts.join("") });
      }
    }, 12_000);

    function settle() {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      const text = parts.join("");
      console.log(`[ASR WS] Settled with: "${text}"`);
      resolve({ text });
    }

    console.log(`[ASR WS] Creating ASR client...`);
    const asr = createVolcengineASR({
      onPartial(text) {
        console.log(`[ASR WS] Partial: "${text}"`);
      },
      onFinal(text) {
        console.log(`[ASR WS] Final: "${text}"`);
        if (text.trim()) parts.push(text.trim());
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

    console.log(`[ASR WS] Waiting for ready...`);
    asr.ready
      .then(() => {
        console.log(`[ASR WS] Ready, sending audio...`);
        asr.sendChunk(audioBuffer);
        console.log(`[ASR WS] Audio sent, closing...`);
        asr.close();
        // Close sends end-of-audio signal then closes WS after 1s
        // Give extra time for server to return final result
        setTimeout(settle, 3000);
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
