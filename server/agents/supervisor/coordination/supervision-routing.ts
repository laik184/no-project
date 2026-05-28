/**
 * server/agents/supervisor/coordination/supervision-routing.ts
 *
 * Routes supervision tasks to the appropriate agent coordinator.
 * Pure orchestration — maps AgentDomain → coordinator call.
 * No direct execution. No tool implementation.
 */

import type { SupervisionTask, TaskOutcome, AgentDomain } from '../types/supervisor.types.ts';
import type { SupervisionContext }                         from '../core/supervisor-context.ts';
import {
  coordinatePlanning,
  coordinateExecution,
  coordinateVerification,
  coordinateBrowser,
  coordinateFilesystem,
  coordinateTerminal,
} from './agent-coordinator.ts';
import { resultError } from './dispatcher-client.ts';

// ── Partial outcome returned by routing (taskId/durationMs/attempt added by runner) ──

type RoutedOutcome =
  | { success: true;  output: string; domain: AgentDomain }
  | { success: false; error: string;  domain: AgentDomain };

// ── Route a task to its agent coordinator ────────────────────────────────────

export async function routeTask(
  task:    SupervisionTask,
  context: SupervisionContext,
): Promise<RoutedOutcome> {
  const { domain, id, input, timeoutMs } = task;

  switch (domain) {
    case 'planner': {
      const goal = String(input.goal ?? context.goal ?? '');
      if (!goal) return fail(domain, 'planner task requires input.goal');
      const r = await coordinatePlanning(goal, context.projectId, context.toolCtx, { timeoutMs });
      return r.ok ? ok(domain, extractOutput(r.data)) : fail(domain, resultError(r));
    }

    case 'executor': {
      const r = await coordinateExecution(id, input, context.toolCtx, { timeoutMs });
      return r.ok ? ok(domain, extractOutput(r.data)) : fail(domain, resultError(r));
    }

    case 'verifier': {
      const r = await coordinateVerification(id, input, context.toolCtx, { timeoutMs });
      return r.ok ? ok(domain, extractOutput(r.data)) : fail(domain, resultError(r));
    }

    case 'browser': {
      const r = await coordinateBrowser(id, input, context.toolCtx, { timeoutMs });
      return r.ok ? ok(domain, extractOutput(r.data)) : fail(domain, resultError(r));
    }

    case 'filesystem': {
      const r = await coordinateFilesystem(id, input, context.toolCtx, { timeoutMs });
      return r.ok ? ok(domain, extractOutput(r.data)) : fail(domain, resultError(r));
    }

    case 'terminal': {
      const r = await coordinateTerminal(id, input, context.toolCtx, { timeoutMs });
      return r.ok ? ok(domain, extractOutput(r.data)) : fail(domain, resultError(r));
    }

    default: {
      const exhaustive: never = domain;
      return fail('executor', `Unknown agent domain: ${String(exhaustive)}`);
    }
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function ok(domain: AgentDomain, output: string): RoutedOutcome {
  return { success: true, output, domain };
}

function fail(domain: AgentDomain, error: string): RoutedOutcome {
  return { success: false, error, domain };
}

function extractOutput(data: unknown): string {
  if (typeof data === 'string') return data.slice(0, 800);
  if (data == null) return '';
  const d = data as Record<string, unknown>;
  const out = d.result ?? d.output ?? d.stdout ?? d.message ?? '';
  return String(out).slice(0, 800);
}
