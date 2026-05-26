/**
 * specialist-executor.ts
 * Tool-loop agent removed — runAgentLoop inlined as stub.
 */

import { getDomainConfig }  from "./domain-agent-router.ts";
import { bus }              from "../../infrastructure/events/bus.ts";
import type { SpecialistTask, SpecialistResult, FilePatch }
  from "../contracts/specialist.contracts.ts";

function emit(runId: string, projectId: number, eventType: string, payload: Record<string, unknown>): void {
  bus.emit("agent.event", { runId, projectId, phase: "coordination", agentName: "specialist-executor", eventType, payload, ts: Date.now() });
}

function extractPatches(summary: string, domain: SpecialistTask["domain"]): FilePatch[] {
  const patches: FilePatch[] = [];
  for (const line of summary.split("\n")) {
    const writeMatch  = line.match(/(?:wrote|updated|modified):\s*([^\s,]+)/i);
    const createMatch = line.match(/(?:created|added):\s*([^\s,]+)/i);
    const deleteMatch = line.match(/(?:deleted|removed):\s*([^\s,]+)/i);
    if (writeMatch?.[1])  patches.push({ filePath: writeMatch[1].trim(),  operation: "update", confidence: 0.85 });
    else if (createMatch?.[1]) patches.push({ filePath: createMatch[1].trim(), operation: "create", confidence: 0.90 });
    else if (deleteMatch?.[1]) patches.push({ filePath: deleteMatch[1].trim(), operation: "delete", confidence: 0.80 });
  }
  if (patches.length === 0 && summary.length > 20) {
    patches.push({ filePath: `[${domain}:summary]`, operation: "update", content: summary.slice(0, 500), confidence: 0.70 });
  }
  return patches;
}

export async function executeSpecialist(task: SpecialistTask, _signal: AbortSignal): Promise<SpecialistResult> {
  const { runId, projectId, domain, goal, taskId } = task;
  const t0 = Date.now();
  const config = getDomainConfig(domain);

  emit(runId, projectId, "specialist.execute.start", { taskId, domain, maxSteps: config.maxSteps });

  const summary    = `[${domain.toUpperCase()} SPECIALIST] Tool-loop agent removed — cannot execute: ${goal.slice(0, 80)}`;
  const durationMs = Date.now() - t0;
  const patches    = extractPatches(summary, domain);

  emit(runId, projectId, "specialist.execute.complete", { taskId, domain, durationMs, stopReason: "agent_removed", patchCount: patches.length, success: false });

  return { taskId, domain, success: false, patches, artifacts: { summary, stopReason: "agent_removed", steps: 0 }, durationMs, error: "Tool-loop agent removed.", retryable: false };
}
