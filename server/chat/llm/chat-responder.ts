/**
 * server/chat/llm/chat-responder.ts
 *
 * Generates and streams an LLM summary response to the user
 * after orchestration completes.
 *
 * Tokens are appended to streamManager while the stream is still open
 * (before completeRun() closes it). If the LLM key is absent, a
 * structured plain-text fallback is used instead — the stream still
 * gets content so the user sees a real reply.
 *
 * Architecture: NEVER throws. All errors are caught and converted to
 * fallback text so the chat run always completes cleanly.
 */

import { getLLMClient, hasLLMKey } from '../../shared/llm-client.ts';
import { streamManager }           from '../orchestration/stream-manager.ts';
import type { OrchestrationResult } from '../../orchestration/types/orchestration.types.ts';

// ── Constants ─────────────────────────────────────────────────────────────────

const DEFAULT_MODEL = process.env.LLM_MODEL ?? 'meta-llama/llama-3.3-70b-instruct';
const MAX_TOKENS    = 180;
const TEMPERATURE   = 0.5;

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildFallbackMessage(goal: string, result: OrchestrationResult): string {
  const shortGoal = goal.slice(0, 120);
  if (result.ok) {
    return (
      `I've completed your request: "${shortGoal}". ` +
      `${result.workflowsCompleted} of ${result.workflowsTotal} workflow(s) ` +
      `finished successfully in ${result.durationMs}ms.`
    );
  }
  const reason = (result.error ?? 'Unknown error').slice(0, 200);
  return (
    `I encountered an issue while processing: "${shortGoal}". ` +
    `Reason: ${reason}. Please check the logs or try rephrasing your request.`
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Stream an LLM-generated summary of the completed orchestration run.
 * Appends tokens to the open streamManager channel for `runId`.
 * Returns the assembled content string (used as fallback in completeRun).
 *
 * Never throws — all failures produce a meaningful fallback message.
 */
export async function streamRunSummary(
  runId:  string,
  goal:   string,
  result: OrchestrationResult,
): Promise<string> {
  // Guard: if stream already closed, return immediately
  if (!streamManager.isActive(runId)) return '';

  // ── Fallback path — no LLM key configured ────────────────────────────────
  if (!hasLLMKey()) {
    const msg = buildFallbackMessage(goal, result);
    streamManager.append(runId, msg);
    return msg;
  }

  // ── LLM streaming path ────────────────────────────────────────────────────
  const systemPrompt = result.ok
    ? "You are a concise AI agent assistant. Confirm you completed the user's request in 2-3 sentences. Be specific about what was done."
    : "You are a concise AI agent assistant. Briefly explain what failed in 2-3 sentences and suggest a concrete next step.";

  const userContext = result.ok
    ? `Goal: "${goal}"\nResult: ${result.workflowsCompleted}/${result.workflowsTotal} workflows completed in ${result.durationMs}ms`
    : `Goal: "${goal}"\nFailure: ${result.error ?? 'Unknown error'}`;

  let assembled = '';

  try {
    const client = getLLMClient();
    const stream = await client.chat.completions.create({
      model:       DEFAULT_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: userContext  },
      ],
      stream:      true,
      max_tokens:  MAX_TOKENS,
      temperature: TEMPERATURE,
    });

    for await (const chunk of stream) {
      const token = chunk.choices[0]?.delta?.content ?? '';
      if (token) {
        if (streamManager.isActive(runId)) {
          streamManager.append(runId, token);
        }
        assembled += token;
      }
    }
  } catch {
    const fallback = buildFallbackMessage(goal, result);
    if (streamManager.isActive(runId)) {
      streamManager.append(runId, fallback);
    }
    return fallback;
  }

  return assembled || buildFallbackMessage(goal, result);
}
