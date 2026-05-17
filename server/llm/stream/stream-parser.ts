/**
 * server/llm/stream/stream-parser.ts
 *
 * Parses individual SSE data lines from the OpenRouter streaming API.
 * OpenRouter format: `data: <JSON>\n\n` or `data: [DONE]\n\n`
 *
 * Each call to parseStreamLine() returns a typed chunk or null (non-data lines).
 */

export interface ContentChunk {
  type: "content";
  token: string;
}

export interface ToolDeltaChunk {
  type: "tool_delta";
  index: number;
  id?: string;
  name?: string;
  argsDelta: string;
}

export interface DoneChunk {
  type: "done";
}

export type StreamChunk = ContentChunk | ToolDeltaChunk | DoneChunk;

/**
 * Parse one raw SSE line into a StreamChunk.
 * Returns null for comment lines, blank lines, and non-data lines.
 */
export function parseStreamLine(line: string): StreamChunk | null {
  if (!line.startsWith("data: ")) return null;

  const payload = line.slice(6).trim();
  if (payload === "[DONE]") return { type: "done" };

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(payload) as Record<string, unknown>;
  } catch {
    return null;
  }

  const choices = parsed.choices as Array<{
    delta?: {
      content?: string;
      tool_calls?: Array<{
        index: number;
        id?: string;
        type?: string;
        function?: { name?: string; arguments?: string };
      }>;
    };
    finish_reason?: string | null;
  }> | undefined;

  const delta = choices?.[0]?.delta;
  if (!delta) return null;

  // ── Content token ──────────────────────────────────────────────────────────
  if (typeof delta.content === "string" && delta.content.length > 0) {
    return { type: "content", token: delta.content };
  }

  // ── Tool call delta ────────────────────────────────────────────────────────
  const tc = delta.tool_calls?.[0];
  if (tc !== undefined) {
    return {
      type:      "tool_delta",
      index:     tc.index ?? 0,
      id:        tc.id,
      name:      tc.function?.name,
      argsDelta: tc.function?.arguments ?? "",
    };
  }

  return null;
}
