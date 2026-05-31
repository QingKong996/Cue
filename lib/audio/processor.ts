/**
 * Audio processing: resample to 16 kHz mono PCM16 chunks.
 */

import { AUDIO_SAMPLE_RATE, AUDIO_CHUNK_DURATION_MS } from "../constants";

export interface AudioProcessor {
  start: () => void;
  stop: () => void;
}

/**
 * Create an audio processor that converts a MediaStream to 16 kHz mono PCM16
 * chunks and delivers them via `onChunk`.
 *
 * Uses a ScriptProcessorNode for simplicity (suitable for prototype).
 */
export function createAudioProcessor(
  stream: MediaStream,
  onChunk: (chunk: ArrayBuffer) => void,
): AudioProcessor {
  const ctx = new AudioContext();
  const source = ctx.createMediaStreamSource(stream);

  // ScriptProcessorNode buffer size — use a power of 2 that is at least as
  // large as one chunk worth of samples at the *native* sample rate.
  // We'll process in the `onaudioprocess` handler regardless of exact alignment.
  const bufferSize = 4096;
  const processor = ctx.createScriptProcessor(bufferSize, 1, 1);

  let resampleRatio = 1;
  let leftover = new Float32Array(0);

  function resample(input: Float32Array): Float32Array {
    if (resampleRatio === 1) return input;

    const outputLength = Math.round(input.length / resampleRatio);
    const output = new Float32Array(outputLength);
    for (let i = 0; i < outputLength; i++) {
      const srcIndex = i * resampleRatio;
      const lo = Math.floor(srcIndex);
      const hi = Math.min(lo + 1, input.length - 1);
      const frac = srcIndex - lo;
      output[i] = input[lo] * (1 - frac) + input[hi] * frac;
    }
    return output;
  }

  function floatTo16BitPCM(float32: Float32Array): ArrayBuffer {
    const buffer = new ArrayBuffer(float32.length * 2);
    const view = new DataView(buffer);
    for (let i = 0; i < float32.length; i++) {
      const s = Math.max(-1, Math.min(1, float32[i]));
      view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    }
    return buffer;
  }

  const samplesPerChunk = Math.round((AUDIO_SAMPLE_RATE * AUDIO_CHUNK_DURATION_MS) / 1000);

  processor.onaudioprocess = (e: AudioProcessingEvent) => {
    const raw = e.inputBuffer.getChannelData(0);
    const resampled = resample(new Float32Array(raw));

    // Concatenate with leftover from previous callback
    const combined = new Float32Array(leftover.length + resampled.length);
    combined.set(leftover, 0);
    combined.set(resampled, leftover.length);

    // Emit complete chunks
    let offset = 0;
    while (offset + samplesPerChunk <= combined.length) {
      const chunk = combined.subarray(offset, offset + samplesPerChunk);
      onChunk(floatTo16BitPCM(chunk));
      offset += samplesPerChunk;
    }

    // Store remainder
    leftover = combined.slice(offset);
  };

  return {
    start() {
      resampleRatio = ctx.sampleRate / AUDIO_SAMPLE_RATE;
      source.connect(processor);
      processor.connect(ctx.destination);
    },
    stop() {
      processor.disconnect();
      source.disconnect();
      ctx.close();
    },
  };
}
