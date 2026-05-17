/**
 * server/llm/stream/openrouter-stream.ts
 *
 * Streaming LLM client for OpenRouter.
 * Makes a fetch() with stream:true, reads the response body line-by-line,
 * calls onToken() for each content token, accumulates tool-call deltas,
 * and resolves with the complete ChatResponse when done.
 *
 * Falls back to non-streaming on environments without ReadableStream.
 */

import { parseStreamLine } from "./stream-parser.ts";
import type { ToolMessage, ToolDef, ChatResponse, ToolCallResult } from "../../agents/llm/openrouter.client.ts";

const BASE_URL = "https://openrouter.ai/api/v1/chat/completions";

export interface StreamOptions {
  onToken?:        (token: string) => void;
  onStreamStart?:  () => void;
  onStreamEnd?:    (content: string) => void;
  signal?:         AbortSignal;
}

/**
 * Tool-call accumulator — merges streaming deltas into complete records.
 */
interface ToolAcc {
  id:   string;
  name: string;
  args: string;
}

export async function streamChatWithTools(
  messages: ToolMessage[],
  tools:    ToolDef[],
  opts:     StreamOptions = {},
): Promise<ChatResponse> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY is not set.");

  const model = process.env.LLM_MODEL || "openai/gpt-4o-mini";

  const body: Record<string, unknown> = {
    model,
    messages,
    stream:      true,
    temperature: 0.1,
    max_tokens:  4096,
  };
  if (tools.length > 0) { body.tools = tools; body.tool_choice = "auto"; }

  const response = await fetch(BASE_URL, {
    method:  "POST",
    headers: {
      Authorization:  `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.REPLIT_DEV_DOMAIN || "https://nura-x.replit.app",
      "X-Title":      "NURA X IDE",
    },
    body:    JSON.stringify(body),
    signal:  opts.signal,
  });

  if (!response.ok) {
    const text = await response.text().catch(() => response.statusText);
    throw new Error(`OpenRouter API error (${response.status}): ${text}`);
  }

  // ── Stream reading ──────────────────────────────────────────────────────────
  const reader  = response.body?.getReader();
  const decoder = new TextDecoder();

  if (!reader) {
    // No stream support — fallback: read full body
    const json = await response.json() as { choices?: Array<{ message?: { content?: string; tool_calls?: any[] } }>; error?: { message: string } };
    if (json.error) throw new Error(`OpenRouter error: ${json.error.message}`);
    const msg = json.choices?.[0]?.message;
    return {
      content:   msg?.content ?? "",
      toolCalls: (msg?.tool_calls ?? []).map((tc: any) => ({ id: tc.id, name: tc.function.name, arguments: tc.function.arguments })),
    };
  }

  const toolMap = new Map<number, ToolAcc>();
  let   content = "";
  let   started = false;
  let   leftover = "";

  opts.onStreamStart?.();

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const text  = leftover + decoder.decode(value, { stream: true });
      const lines = text.split("\n");
      leftover    = lines.pop() ?? "";          // last may be incomplete

      for (const line of lines) {
        const chunk = parseStreamLine(line);
        if (!chunk) continue;

        if (chunk.type === "done") break;

        if (chunk.type === "content") {
          if (!started) { started = true; }
          content += chunk.token;
          opts.onToken?.(chunk.token);
        }

        if (chunk.type === "tool_delta") {
          const acc = toolMap.get(chunk.index) ?? { id: "", name: "", args: "" };
          if (chunk.id)   acc.id   = chunk.id;
          if (chunk.name) acc.name = chunk.name;
          acc.args += chunk.argsDelta;
          toolMap.set(chunk.index, acc);
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  opts.onStreamEnd?.(content);

  const toolCalls: ToolCallResult[] = Array.from(toolMap.values()).map((tc) => ({
    id:        tc.id,
    name:      tc.name,
    arguments: tc.args,
  }));

  return { content, toolCalls };
}
