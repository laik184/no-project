export interface LlmClient {
  complete: (prompt: string) => Promise<string>;
}

interface LlmConfig {
  readonly apiKey?: string;
  readonly baseUrl?: string;
  readonly model?: string;
}

const DEFAULT_MODEL = "gpt-4.1-mini";
const DEFAULT_BASE_URL = "https://api.openai.com/v1/chat/completions";

export function createLlmClient(config: LlmConfig = {}): LlmClient {
  const apiKey = config.apiKey ?? process.env.OPENAI_API_KEY ?? process.env.OPENROUTER_API_KEY ?? process.env.AI_INTEGRATIONS_OPENROUTER_API_KEY;
  const baseUrl = config.baseUrl ?? process.env.LLM_BASE_URL ?? DEFAULT_BASE_URL;
  const model = config.model ?? process.env.LLM_MODEL ?? DEFAULT_MODEL;

  return {
    complete: async (prompt: string): Promise<string> => {
      if (!apiKey) {
        throw new Error("Missing LLM API key. Set OPENAI_API_KEY or OPENROUTER_API_KEY.");
      }

      const response = await fetch(baseUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          temperature: 0.1,
          messages: [
            {
              role: "system",
              content: "You are a strict production code generator. Return JSON only.",
            },
            { role: "user", content: prompt },
          ],
        }),
      });

      if (!response.ok) {
        const reason = await response.text();
        throw new Error(`LLM request failed (${response.status}): ${reason}`);
      }

      const json = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };

      const content = json.choices?.[0]?.message?.content;
      if (!content) {
        throw new Error("LLM response is empty.");
      }

      return content;
    },
  };
}
