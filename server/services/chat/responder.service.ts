/**
 * server/services/chat/responder.service.ts
 *
 * LLM-based summary streamer for run completion.
 * Falls back to plain text if no LLM key is configured.
 *
 * Owns: streamRunSummary(), LLM response generation, fallback responses.
 */

import { getLLMClient, getDefaultModel, hasLLMKey } from '../../shared/llm-client.ts';
import { streamManager }     from './stream.service.ts';
import type { OrchestrationResult } from '../../orchestration/types/orchestration.types.ts';

const FALLBACK_MSG = 'Run completed successfully.';

// ── Agent output extraction ───────────────────────────────────────────────────

/**
 * Extract a human-readable string from a single PhaseResult.output value.
 * Tries named text fields first, then executor/coderx outputs[] array, then JSON.
 */
function extractPhaseOutput(output: unknown, maxLen = 500): string {
  if (output === null || output === undefined) return '';
  if (typeof output === 'string') return output.slice(0, maxLen);
  if (typeof output !== 'object') return String(output).slice(0, maxLen);

  const o = output as Record<string, unknown>;

  // Named text fields — common across agent result shapes
  for (const key of ['summary', 'response', 'message', 'result', 'description', 'text']) {
    const val = o[key];
    if (typeof val === 'string' && val.trim().length > 0) {
      return val.slice(0, maxLen);
    }
  }

  // executor / coderx: outputs[] array of per-task results
  if (Array.isArray(o['outputs'])) {
    const lines: string[] = [];
    for (const task of (o['outputs'] as Record<string, unknown>[])) {
      const desc = typeof task['description'] === 'string'
        ? task['description']
        : String(task['taskId'] ?? '');
      const ok  = task['ok'] !== false ? '✓' : '✗';
      const err = typeof task['error'] === 'string'
        ? ` (${task['error'].slice(0, 80)})`
        : '';
      if (desc) lines.push(`${ok} ${desc}${err}`);
    }
    if (lines.length > 0) return lines.join('\n').slice(0, maxLen);
  }

  // planner: plan with workflows array
  if (Array.isArray(o['workflows'])) {
    const count = (o['workflows'] as unknown[]).length;
    return `Planned ${count} workflow(s)`;
  }

  // Fallback: compact JSON (truncated)
  try {
    return JSON.stringify(output).slice(0, maxLen);
  } catch {
    return '';
  }
}

/**
 * Build a multi-agent output context string from all workflow phase results.
 * Returns empty string when there is no meaningful output to show.
 */
function buildAgentOutputContext(result: OrchestrationResult): string {
  const lines: string[] = [];

  for (const wf of result.results) {
    for (const phase of wf.phaseResults) {
      const content = extractPhaseOutput(phase.output);
      if (content) {
        lines.push(`[${phase.agentType}]: ${content}`);
      } else if (!phase.ok && phase.error) {
        lines.push(`[${phase.agentType} failed]: ${phase.error.slice(0, 200)}`);
      }
    }
  }

  return lines.join('\n\n');
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function streamRunSummary(
  runId:     string,
  projectId: number,
  result:    OrchestrationResult,
  goal?:     string,
): Promise<void> {
  const agentContext = buildAgentOutputContext(result);
  const metaSummary  = result.ok
    ? `Completed ${result.workflowsCompleted} workflow(s) in ${result.durationMs}ms.`
    : (result.error ?? FALLBACK_MSG);

  streamManager.open(runId, projectId);

  if (!hasLLMKey()) {
    const msg = agentContext
      ? `${metaSummary}\n\n${agentContext}`
      : metaSummary;
    streamManager.append(runId, msg);
    streamManager.close(runId);
    return;
  }

  try {
    const client = getLLMClient();
    const model  = getDefaultModel();

    const goalLine    = goal ? `Goal: ${goal}\n` : '';
    const contextLine = agentContext ? `\nAgent output:\n${agentContext}\n` : '';

    const prompt = result.ok
      ? `${goalLine}${metaSummary}${contextLine}\nSummarize what the agents accomplished in 1–2 clear sentences for the user.`
      : `The agent run failed.\n${goalLine}Error: ${result.error ?? 'Unknown error'}\nWrite a short, helpful 1-sentence explanation for the user.`;

    const stream = await client.chat.completions.create({
      model,
      messages:   [{ role: 'user', content: prompt }],
      stream:     true,
      max_tokens: 256,
    });

    for await (const chunk of stream) {
      const token = chunk.choices[0]?.delta?.content;
      if (token) streamManager.append(runId, token);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : FALLBACK_MSG;
    streamManager.append(runId, msg);
  } finally {
    streamManager.close(runId);
  }
}

export const chatResponderService = { streamRunSummary };
export const responderService      = chatResponderService;
