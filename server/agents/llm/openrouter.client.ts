const DEFAULT_MODEL = "openai/gpt-4o-mini";
const BASE_URL = "https://openrouter.ai/api/v1/chat/completions";

export interface ToolMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_calls?: Array<{
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }>;
  tool_call_id?: string;
}

export interface ToolCallResult {
  id: string;
  name: string;
  arguments: string;
}

export interface ChatResponse {
  content: string;
  toolCalls: ToolCallResult[];
}

export interface ToolDef {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: {
      type: "object";
      properties: Record<string, unknown>;
      required?: string[];
    };
  };
}

async function chatWithTools(
  messages: ToolMessage[],
  tools: ToolDef[],
  options?: { signal?: AbortSignal }
): Promise<ChatResponse> {
  const apiKey = process.env.OPENROUTER_API_KEY || process.env.AI_INTEGRATIONS_OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("No OpenRouter API key found. Add OPENROUTER_API_KEY in Replit Secrets.");
  }

  const model = process.env.LLM_MODEL || DEFAULT_MODEL;

  const body: Record<string, unknown> = {
    model,
    messages,
    temperature: 0.1,
    max_tokens: 4096,
  };

  if (tools.length > 0) {
    body.tools = tools;
    body.tool_choice = "auto";
  }

  const response = await fetch(BASE_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.REPLIT_DEV_DOMAIN || "https://nura-x.replit.app",
      "X-Title": "NURA X IDE",
    },
    body: JSON.stringify(body),
    signal: options?.signal,
  });

  if (!response.ok) {
    const text = await response.text().catch(() => response.statusText);
    throw new Error(`OpenRouter API error (${response.status}): ${text}`);
  }

  const json = (await response.json()) as {
    choices?: Array<{
      message?: {
        content?: string;
        tool_calls?: Array<{
          id: string;
          type: string;
          function: { name: string; arguments: string };
        }>;
      };
    }>;
    error?: { message: string };
  };

  if (json.error) {
    throw new Error(`OpenRouter error: ${json.error.message}`);
  }

  const message = json.choices?.[0]?.message;
  if (!message) {
    throw new Error("Empty response from OpenRouter");
  }

  const toolCalls: ToolCallResult[] = (message.tool_calls ?? []).map((tc) => ({
    id: tc.id,
    name: tc.function.name,
    arguments: tc.function.arguments,
  }));

  return {
    content: message.content ?? "",
    toolCalls,
  };
}

async function complete(prompt: string): Promise<string> {
  const res = await chatWithTools(
    [
      { role: "system", content: "You are a helpful assistant. Respond concisely." },
      { role: "user", content: prompt },
    ],
    []
  );
  return res.content;
}

// ── Streaming variant ──────────────────────────────────────────────────────

export interface StreamOptions {
  onToken?:       (token: string) => void;
  onStreamStart?: () => void;
  onStreamEnd?:   (content: string) => void;
  signal?:        AbortSignal;
}

async function streamChatWithTools(
  messages: ToolMessage[],
  tools: ToolDef[],
  opts: StreamOptions = {},
): Promise<ChatResponse> {
  // Dynamic import keeps the streaming module tree-shaken from non-streaming paths
  const { streamChatWithTools: _stream } = await import("../../llm/stream/openrouter-stream.ts");
  return _stream(messages, tools, opts);
}

export const llm = { chatWithTools, streamChatWithTools, complete };
