/**
 * node-executor.ts  (≤250 lines)
 *
 * Dispatches DAG nodes to tool / agent / verify / checkpoint / decision subsystems.
 *
 * Fix #1 + #7 — Dual executor elimination + context unification.
 *   The shadow path (unifiedRegistry.getEntry → executeTool from core/) has been
 *   replaced with the canonical path (dispatch() from registry/tool-dispatcher.ts).
 *   Benefits:
 *     - retry policy is now enforced on engine tool calls
 *     - permission validation runs on all tool invocations
 *     - metrics and audit are recorded for every tool call
 *     - single ToolExecutionContext type used throughout
 *
 * MEMORY SAFETY (retained):
 *   File writes produced by tool nodes are routed through nodeWriteDispatcher
 *   → transactionalMemoryWriter → deterministicWriteCoordinator.
 *   No direct fs writes are permitted from this module.
 */

import { bus }                    from "../../infrastructure/events/bus.ts";
import { dagCheckpointStore }     from "../checkpoints/dag-checkpoint-store.ts";
import { createCheckpoint }       from "../graph/graph-state.ts";
import { agentPromiseRegistry }   from "./agent-promise-registry.ts";
import { nodeWriteDispatcher }    from "./node-write-dispatcher.ts";
import {
  emitNodeStarted,
  emitNodeCompleted,
  emitNodeFailed,
  emitNodeRetry,
} from "../dag/dag-telemetry.ts";
import type { ExecutionGraph, ExecutionNode } from "../graph/graph-types.ts";
import type { NodeExecutor }                  from "../graph/parallel-runner.ts";

// ── Canonical imports (Fix #1 — eliminates shadow executor) ──────────────────
import { dispatch }       from "../../tools/registry/tool-dispatcher.ts";
import { buildContext }   from "../../tools/shared/context-builder.ts";

export interface NodeExecutorContext {
  runId:     string;
  projectId: number;
}

// ── Factory ───────────────────────────────────────────────────────────────────

export function createNodeExecutor(ctx: NodeExecutorContext): NodeExecutor {
  const telCtx = { runId: ctx.runId, projectId: ctx.projectId, graphId: ctx.runId };

  return async (node: ExecutionNode, graph: ExecutionGraph): Promise<unknown> => {
    const t0 = Date.now();
    emitNodeStarted(telCtx, node);

    try {
      const result     = await dispatchNode(node, ctx);
      const durationMs = Date.now() - t0;
      emitNodeCompleted(telCtx, node, durationMs);

      if (node.isCheckpoint) {
        const cp = createCheckpoint(graph, node.id);
        dagCheckpointStore.save(ctx.runId, ctx.projectId, cp);
      }

      return result;

    } catch (err) {
      const durationMs = Date.now() - t0;
      const error      = err instanceof Error ? err.message : String(err);

      if (node.retryCount < node.maxRetries) {
        emitNodeRetry(telCtx, node, node.retryCount + 1);
      } else {
        emitNodeFailed(telCtx, node, error);
      }

      throw err;
    }
  };
}

// ── Per-type dispatch ─────────────────────────────────────────────────────────

async function dispatchNode(node: ExecutionNode, ctx: NodeExecutorContext): Promise<unknown> {
  switch (node.type) {
    case "tool":       return dispatchTool(node, ctx);
    case "agent":      return dispatchAgent(node, ctx);
    case "verify":     return dispatchVerify(node, ctx);
    case "checkpoint": return dispatchCheckpointNode(node, ctx);
    case "decision":   return dispatchDecision(node, ctx);
    default:           return dispatchAgent(node, ctx);
  }
}

// ── Tool dispatch — canonical path (Fix #1 + #7) ─────────────────────────────

async function dispatchTool(node: ExecutionNode, ctx: NodeExecutorContext): Promise<unknown> {
  const toolName = node.toolName;
  if (!toolName) throw new Error(`Node "${node.id}" type=tool missing toolName`);

  // Fix #7: single context type — ToolExecutionContext via buildContext()
  // Fix #1: canonical dispatch() — includes retry, permissions, timeout, metrics, audit
  const toolCtx = buildContext(ctx.runId, String(ctx.projectId));
  const result  = await dispatch(toolName, node.args as Record<string, unknown>, toolCtx);

  if (!result.ok) {
    throw new Error(result.error ?? `Tool "${toolName}" failed`);
  }

  // Route file writes through the safe write queue
  const data       = (result as { ok: true; data: unknown }).data;
  const fileWrites = (data as Record<string, unknown>)?.fileWrites;
  if (Array.isArray(fileWrites) && fileWrites.length > 0) {
    await nodeWriteDispatcher.dispatchBatch(
      fileWrites,
      { runId: ctx.runId, projectId: ctx.projectId, nodeId: node.id, toolName },
    );
  }

  return data;
}

// ── Agent dispatch ────────────────────────────────────────────────────────────

function registryKey(runId: string, nodeId: string): string {
  return `${runId}:${nodeId}`;
}

async function dispatchAgent(node: ExecutionNode, ctx: NodeExecutorContext): Promise<unknown> {
  const key            = registryKey(ctx.runId, node.id);
  const agentTimeoutMs = (node.args as Record<string, unknown>)?.agentTimeoutMs as number | undefined;
  const resultPromise  = agentPromiseRegistry.register(key, agentTimeoutMs);

  bus.emit("agent.event" as never, {
    runId:     ctx.runId,
    projectId: ctx.projectId,
    phase:     "dag.agent",
    agentName: node.agentRole ?? "builder",
    eventType: "dag.agent.execute",
    payload:   {
      nodeId:     node.id,
      label:      node.label,
      goal:       (node.args as Record<string, unknown>)?.goal ?? node.label,
      tools:      (node.args as Record<string, unknown>)?.tools,
      promiseKey: key,
    },
    ts: Date.now(),
  });

  return resultPromise;
}

// ── Verify dispatch ───────────────────────────────────────────────────────────

async function dispatchVerify(node: ExecutionNode, ctx: NodeExecutorContext): Promise<unknown> {
  const key           = registryKey(ctx.runId, node.id);
  const resultPromise = agentPromiseRegistry.register(key);

  bus.emit("agent.event" as never, {
    runId:     ctx.runId,
    projectId: ctx.projectId,
    phase:     "dag.verify",
    agentName: "verification",
    eventType: "dag.verify.execute",
    payload:   { nodeId: node.id, args: node.args, promiseKey: key },
    ts:        Date.now(),
  });

  return resultPromise;
}

// ── Checkpoint node dispatch ──────────────────────────────────────────────────

async function dispatchCheckpointNode(node: ExecutionNode, ctx: NodeExecutorContext): Promise<unknown> {
  bus.emit("agent.event" as never, {
    runId:     ctx.runId,
    projectId: ctx.projectId,
    phase:     "dag.checkpoint",
    agentName: "dag-executor",
    eventType: "dag.checkpoint.saved",
    payload:   { nodeId: node.id, label: node.label },
    ts:        Date.now(),
  });
  return { checkpointed: true, nodeId: node.id };
}

// ── Decision node dispatch ────────────────────────────────────────────────────

async function dispatchDecision(node: ExecutionNode, ctx: NodeExecutorContext): Promise<unknown> {
  bus.emit("agent.event" as never, {
    runId:     ctx.runId,
    projectId: ctx.projectId,
    phase:     "dag.decision",
    agentName: "dag-executor",
    eventType: "dag.decision.reached",
    payload:   { nodeId: node.id, label: node.label, args: node.args },
    ts:        Date.now(),
  });
  return { decision: node.label, nodeId: node.id };
}
