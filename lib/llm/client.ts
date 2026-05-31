import { DEEPSEEK_BASE_URL } from "@/lib/constants";

export type DeepSeekMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type DeepSeekOptions = {
  temperature?: number;
  max_tokens?: number;
  response_format?: { type: "json_object" };
};

export async function callDeepSeek(
  model: string,
  messages: DeepSeekMessage[],
  options?: DeepSeekOptions,
): Promise<string> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    throw new Error("DEEPSEEK_API_KEY is not set in environment variables");
  }

  const body = {
    model,
    messages,
    temperature: options?.temperature ?? 0.3,
    max_tokens: options?.max_tokens ?? 2048,
    ...(options?.response_format && {
      response_format: options.response_format,
    }),
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);

  try {
    const response = await fetch(`${DEEPSEEK_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "unknown error");
      throw new Error(
        `DeepSeek API error ${response.status}: ${errorText}`,
      );
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (typeof content !== "string") {
      throw new Error("DeepSeek API returned unexpected response shape");
    }
    return content;
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error("DeepSeek API request timed out (30s)");
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}
