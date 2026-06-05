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

// ── Error message humaniser ───────────────────────────────────────────────────

function toFriendlyError(agentType: string, error: string): string {
  const low = error.toLowerCase();
  if (/no.*api.*key|api.*key.*not|not configured|missing.*key/i.test(error)) {
    return '⚠️  AI model is not configured — add OPENROUTER_API_KEY to your environment to enable it.';
  }
  if (/timeout/i.test(error)) {
    return '⚠️  The operation timed out. The agent will retry automatically.';
  }
  if (/llm call failed/i.test(error)) {
    const stripped = error.replace(/\[llm-client\]/gi, '').replace(/\[.*?\]/g, '').trim();
    return `⚠️  AI model error: ${stripped.slice(0, 120)}`;
  }
  if (low.includes('tool not found') || low.includes('not registered')) {
    return `⚠️  A required capability is unavailable (${agentType}). Try again later.`;
  }
  if (low.includes('permission denied') || low.includes('eperm') || low.includes('eacces')) {
    return '⚠️  File permission denied in the sandbox.';
  }
  return error.slice(0, 160);
}

// ── Agent output extraction ───────────────────────────────────────────────────

/**
 * Extract a human-readable string from a single PhaseResult.output value.
 *
 * Tries in order:
 *   1. Named text fields (summary, response, message, …)
 *   2. executor / coderx: outputs[] per-task array
 *   3. planner: planId + plan object → describe phase count
 *   4. planner: top-level workflows[] array
 *   5. verifier: { ok, steps[] } → pass/fail summary
 *   6. verifier: { ok, phases[] } → phase name list
 *   7. Fallback: compact JSON (capped at maxLen)
 */
function extractPhaseOutput(output: unknown, maxLen = 500): string {
  if (output === null || output === undefined) return '';
  if (typeof output === 'string') return output.slice(0, maxLen);
  if (typeof output !== 'object') return String(output).slice(0, maxLen);

  const o = output as Record<string, unknown>;

  // 1. Named text fields — common across agent result shapes
  for (const key of ['summary', 'response', 'message', 'result', 'description', 'text']) {
    const val = o[key];
    if (typeof val === 'string' && val.trim().length > 0) {
      return val.slice(0, maxLen);
    }
  }

  // 2. executor / coderx: outputs[] array of per-task results
  if (Array.isArray(o['outputs'])) {
    const lines: string[] = [];
    for (const task of (o['outputs'] as Record<string, unknown>[])) {
      const desc = typeof task['description'] === 'string'
        ? task['description']
        : String(task['taskId'] ?? '');
      const ok   = task['ok'] !== false ? '✓' : '✗';
      const err  = typeof task['error'] === 'string'
        ? ` (${toFriendlyError('executor', task['error']).slice(0, 100)})`
        : '';
      if (desc) lines.push(`${ok} ${desc}${err}`);
    }
    if (lines.length > 0) return lines.join('\n').slice(0, maxLen);
  }

  // 3. planner: { planId, plan: { phases[], workflows[], tasks[] } }
  if (o['planId'] && o['plan'] && typeof o['plan'] === 'object') {
    const plan = o['plan'] as Record<string, unknown>;
    const phases    = Array.isArray(plan['phases'])    ? (plan['phases'] as unknown[]).length    : 0;
    const workflows = Array.isArray(plan['workflows']) ? (plan['workflows'] as unknown[]).length : 0;
    const tasks     = Array.isArray(plan['tasks'])     ? (plan['tasks'] as unknown[]).length     : 0;
    const count = phases || workflows || tasks;
    if (count > 0) {
      const unit = phases ? 'phase' : workflows ? 'workflow' : 'task';
      return `Plan ready — ${count} ${unit}${count !== 1 ? 's' : ''} identified`;
    }
    return 'Plan created successfully';
  }

  // 4. planner: top-level workflows array
  if (Array.isArray(o['workflows'])) {
    const count = (o['workflows'] as unknown[]).length;
    return `Planned ${count} workflow${count !== 1 ? 's' : ''}`;
  }

  // 5. verifier: { ok, steps[] }
  if ('ok' in o && Array.isArray(o['steps'])) {
    const steps  = o['steps'] as Record<string, unknown>[];
    const total  = steps.length;
    const failed = steps.filter(s => s['success'] === false);
    const passed = total - failed.length;
    if (o['ok'] || failed.length === 0) {
      return `All ${total} check${total !== 1 ? 's' : ''} passed ✓`;
    }
    const failNames = failed
      .slice(0, 3)
      .map(s => String(s['phase'] ?? s['stepId'] ?? 'check'))
      .join(', ');
    return `${failed.length} check${failed.length !== 1 ? 's' : ''} failed (${failNames}) — ${passed} passed`;
  }

  // 6. verifier: { ok, phases[] }
  if ('ok' in o && Array.isArray(o['phases'])) {
    const phases = (o['phases'] as unknown[]).map(String).join(', ');
    return o['ok']
      ? `Verification passed (${phases})`
      : `Verification failed (${phases})`;
  }

  // 7. Fallback: compact JSON — truncated hard at maxLen
  try {
    const raw = JSON.stringify(output);
    return raw.length <= maxLen ? raw : raw.slice(0, maxLen - 3) + '…';
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
      if (phase.ok) {
        const content = extractPhaseOutput(phase.output);
        if (content) lines.push(`[${phase.agentType}]: ${content}`);
      } else {
        const errText = phase.error ?? 'Failed';
        lines.push(`[${phase.agentType}]: ${toFriendlyError(phase.agentType, errText)}`);
      }
    }
  }

  return lines.join('\n\n');
}

// ── No-LLM fallback formatter ─────────────────────────────────────────────────

/**
 * Builds a clean plain-text summary when no LLM key is available.
 * Avoids showing raw JSON or internal prefixes like "[planner]:".
 */
function buildFallbackMessage(
  result:       OrchestrationResult,
  metaSummary:  string,
  agentContext: string,
): string {
  if (!agentContext) return metaSummary;

  // Strip `[agentType]:` prefixes — turn them into bullet points
  const lines = agentContext
    .split('\n\n')
    .filter(Boolean)
    .map(line => {
      const match = line.match(/^\[([^\]]+)\]:\s*/);
      if (match) {
        return `• ${line.slice(match[0].length)}`;
      }
      return `• ${line}`;
    });

  return `${metaSummary}\n\n${lines.join('\n')}`;
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
    ? `Completed ${result.workflowsCompleted} workflow${result.workflowsCompleted !== 1 ? 's' : ''} in ${result.durationMs}ms.`
    : toFriendlyError('run', result.error ?? 'Unknown error');

  streamManager.open(runId, projectId);

  if (!hasLLMKey()) {
    const msg = buildFallbackMessage(result, metaSummary, agentContext);
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
      : `The agent run failed.\n${goalLine}Error: ${metaSummary}\nWrite a short, helpful 1-sentence explanation for the user.`;

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
    const msg = buildFallbackMessage(result, metaSummary, agentContext);
    streamManager.append(runId, msg);
  } finally {
    streamManager.close(runId);
  }
}

export const chatResponderService = { streamRunSummary };
export const responderService      = chatResponderService;
