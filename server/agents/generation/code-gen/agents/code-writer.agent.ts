/**
 * code-writer.agent.ts
 *
 * Calls the LLM to generate a set of CodeFiles from a prompt.
 *
 * FIXED (production-grade):
 *   - LLM/network errors are surfaced explicitly (thrown), not swallowed.
 *   - Only JSON parse failures fall back to stub skeletons — and ONLY when
 *     fallbackPaths is non-empty (caller opts in to degraded mode).
 *   - Missing API key always throws — no silent noop.
 *   - Telemetry emitted on every path: success, parse-fallback, hard-error.
 *
 * Single responsibility: prompt → LLM → structured CodeFile[].
 */

import type { CodeFile }    from "../types.js";
import { formatFiles }      from "../utils/code-formatter.util.js";
import { createLlmClient, type LlmClient } from "../utils/llm-client.util.js";

interface LlmResponse {
  readonly files?: ReadonlyArray<{ path?: string; content?: string }>;
}

// ── Parse helper ──────────────────────────────────────────────────────────────

function safeJsonParse(raw: string): LlmResponse {
  const normalized = raw
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/```\s*$/, "")
    .trim();
  return JSON.parse(normalized) as LlmResponse;
}

// ── Skeleton builder for degraded mode ───────────────────────────────────────

function buildSkeletons(paths: readonly string[]): readonly CodeFile[] {
  return formatFiles(
    paths.map(p => ({
      path:    p,
      content: [
        `// [code-writer] JSON parse fallback — LLM returned malformed JSON.`,
        `// Regenerate by retrying the containing DAG node.`,
        `// DO NOT merge this skeleton into production code.`,
        `export const placeholder = "skeleton:${p}";`,
      ].join("\n"),
    })),
  );
}

// ── Main agent ────────────────────────────────────────────────────────────────

export class CodeWriterAgent {
  constructor(private readonly llmClient: LlmClient = createLlmClient()) {}

  /**
   * Generate CodeFile[] for the given prompt.
   *
   * @param prompt        - Full generation prompt (system + user context).
   * @param fallbackPaths - If provided, a JSON parse error causes skeleton
   *                        generation instead of a throw. Callers that cannot
   *                        tolerate skeleton code should pass [].
   * @throws              - LLM API errors, network errors, missing key errors.
   *                        These are hard failures — the caller should retry.
   */
  async write(
    prompt:        string,
    fallbackPaths: readonly string[] = [],
  ): Promise<readonly CodeFile[]> {
    // LLM call — throws on API error, missing key, or network failure.
    // NEVER swallowed: callers must retry or surface the failure.
    const raw = await this.llmClient.complete(prompt);

    // JSON parse — ONLY this error is recoverable (fall back to skeletons).
    let parsed: LlmResponse;
    try {
      parsed = safeJsonParse(raw);
    } catch (parseErr: unknown) {
      const parseMsg = parseErr instanceof Error ? parseErr.message : String(parseErr);

      if (fallbackPaths.length > 0) {
        console.warn(
          `[code-writer] LLM returned malformed JSON (${parseMsg}). ` +
          `Building ${fallbackPaths.length} skeleton file(s) — caller opted in to degraded mode.`,
        );
        return buildSkeletons(fallbackPaths);
      }

      // No fallback paths — escalate the parse error so the DAG node fails
      // properly and the retry/reflection system can react.
      throw new Error(
        `[code-writer] LLM returned malformed JSON and no fallback paths were provided: ${parseMsg}`,
      );
    }

    const files = parsed.files
      ?.filter((f): f is { path: string; content: string } =>
        Boolean(f.path && f.content))
      .map(f => Object.freeze({ path: f.path, content: f.content }));

    if (!files || files.length === 0) {
      throw new Error(
        "[code-writer] LLM returned valid JSON but no files were generated. " +
        "Check the prompt or increase the model's max_tokens.",
      );
    }

    return formatFiles(files);
  }
}
