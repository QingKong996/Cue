/**
 * Volcengine non-streaming ASR — HTTP API.
 * Sends complete audio buffer, returns recognized text.
 * Compatible with Vercel serverless functions.
 */

export type ASRResult = {
  text: string;
  utterances?: Array<{ text: string; definite: boolean }>;
};

/**
 * Recognize a complete audio buffer using Volcengine's HTTP ASR API.
 * Audio should be 16kHz mono 16-bit PCM.
 */
export async function recognizeAudio(
  audioBuffer: ArrayBuffer,
): Promise<ASRResult> {
  const appId = process.env.VOLCENGINE_APP_KEY;
  const accessToken = process.env.VOLCENGINE_ACCESS_KEY_ID;

  if (!appId || !accessToken) {
    throw new Error("Missing VOLCENGINE credentials");
  }

  // Convert to base64
  const bytes = Buffer.from(audioBuffer);
  const audioBase64 = bytes.toString("base64");

  const payload = {
    app: {
      appid: appId,
      token: "access_token",
      cluster: "volcengine_input_common",
    },
    user: {
      uid: "cue-user",
    },
    audio: {
      format: "pcm",
      codec: "raw",
      rate: 16000,
      bits: 16,
      channel: 1,
    },
    request: {
      reqid: crypto.randomUUID(),
      sequence: -1,
      nbest: 1,
      text: "",
      show_utterances: true,
    },
    additions: {
      with_speaker_info: "False",
    },
  };

  const response = await fetch(
    "https://openspeech.bytedance.com/api/v1/auc",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer;${appId};${accessToken}`,
      },
      body: JSON.stringify({
        ...payload,
        audio: {
          ...payload.audio,
          data: audioBase64,
        },
      }),
    },
  );

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Volcengine HTTP ASR failed: ${response.status} ${text}`);
  }

  const data = await response.json();

  // Parse response
  const result: ASRResult = { text: "" };

  if (data.result && typeof data.result.text === "string") {
    result.text = data.result.text;
  }

  if (Array.isArray(data.result?.utterances)) {
    result.utterances = data.result.utterances.map(
      (u: { text: string; definite?: boolean }) => ({
        text: u.text,
        definite: !!u.definite,
      }),
    );
  }

  return result;
}
