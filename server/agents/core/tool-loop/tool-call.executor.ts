/**
 * server/agents/core/tool-loop/tool-call.executor.ts
 *
 * Single-tool-call execution unit.
 * Handles: arg parsing → verifier gate → tool lookup → execute → observe.
 *
 * Architecture spec (T007):
 *   runToolCallVerifier is called PRE-execution to catch unknown tools and
 *   malformed args before any side effects occur. If the verifier blocks,
 *   execution is skipped and an error result is returned immediately.
 */

import { toolOrchestrator, TERMINAL_TOOL_NAMES } from "../../../tools/orchestrator.ts";
import type { ToolContext }                       from "../../../tools/orchestrator.ts";
import { executionObserver }                      from "../../../tools/observation/index.ts";
import { bus }                                    from "../../../infrastructure/events/bus.ts";
import { runToolCallVerifier }                    from "../../../verifiers/tool-call-verifier.ts";

// ── Public contract ────────────────────────────────────────────────────────────

export interface ToolCallInput {
  callId:   string;
  name:     string;
  args:     string; // raw JSON from LLM function-call arguments
  ctx:      ToolContext;
}

export interface ToolCallOutput {
  content:    string;                       // full message content for messages[]
  isTerminal: boolean;                      // was a terminal tool (task_complete) called?
  execOk:     boolean;                      // did the tool succeed?
  parsedArgs: Record<string, unknown>;      // needed by verification gate
}

// ── Executor ──────────────────────────────────────────────────────────────────

export async function executeToolCall(input: ToolCallInput): Promise<ToolCallOutput> {
  const { callId, name, args, ctx } = input;

  // ── 1. Parse args ─────────────────────────────────────────────────────────
  let parsedArgs: Record<string, unknown> = {};
  try {
    parsedArgs = args ? (JSON.parse(args) as Record<string, unknown>) : {};
  } catch {
    const err = `Tool ${name}: invalid JSON arguments`;
    emitError(ctx.runId, name, err);
    return { content: JSON.stringify({ ok: false, error: err }), isTerminal: false, execOk: false, parsedArgs };
  }

  // ── 2. Verifier gate (pre-execution) ──────────────────────────────────────
  // Validates tool name is known and args are well-formed before any side effects.
  const verifyResult = await runToolCallVerifier([{ id: callId, name, arguments: args }]);
  if (verifyResult.blocksExecution) {
    const err = verifyResult.detail ?? verifyResult.message;
    emitError(ctx.runId, name, err);
    bus.emit("agent.event", {
      runId:     ctx.runId,
      eventType: "verifier.blocked" as any,
      phase:     "tool-loop",
      payload:   { verifier: "tool_call", tool: name, reason: err },
      ts:        Date.now(),
    });
    return { content: JSON.stringify({ ok: false, error: err }), isTerminal: false, execOk: false, parsedArgs };
  }

  // ── 3. Unknown tool guard (belt-and-suspenders after verifier) ────────────
  if (!toolOrchestrator.has(name)) {
    const err = `Unknown tool: ${name}`;
    emitError(ctx.runId, name, err);
    return { content: JSON.stringify({ ok: false, error: err }), isTerminal: false, execOk: false, parsedArgs };
  }

  // ── 4. Execute ────────────────────────────────────────────────────────────
  const startTs    = Date.now();
  const result     = await toolOrchestrator.execute(name, parsedArgs, ctx);
  const durationMs = Date.now() - startTs;

  // ── 5. Observe ────────────────────────────────────────────────────────────
  // observe() produces a structured [OBSERVATION] block appended to tool result
  // so the LLM can reason about what actually happened.
  const observation = executionObserver.observe(name, result, ctx, startTs, durationMs);
  const content     = executionObserver.buildContent(result, observation);

  return {
    content,
    isTerminal: TERMINAL_TOOL_NAMES.has(name) && result.ok,
    execOk:     result.ok,
    parsedArgs,
  };
}

// ── Private ───────────────────────────────────────────────────────────────────

function emitError(runId: string, tool: string, error: string): void {
  bus.emit("agent.event", {
    runId,
    eventType: "agent.tool_call",
    phase:     "tool-loop",
    payload:   { tool, status: "error", error },
    ts:        Date.now(),
  });
}
