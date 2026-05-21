/**
 * server/agents/core/tool-loop/tool-call.executor.ts
 *
 * Single-tool-call execution unit.
 * Pipeline: arg parse → policy gate → verifier gate → execute → security scan → observe
 *
 * Architecture spec (T007):
 *   1. PolicyEngine  — enforces tool usage limits, filesystem safety, cmd safety
 *   2. ToolCallVerifier — validates tool name is known + args are well-formed
 *   3. Execute
 *   4. SecurityScanner — scans any code written for leaks, eval, injection, SSRF
 *   5. Observe — structured [OBSERVATION] block for LLM reasoning
 */

import { toolOrchestrator, TERMINAL_TOOL_NAMES } from "../../../tools/orchestrator.ts";
import type { ToolContext }                       from "../../../tools/orchestrator.ts";
import { executionObserver }                      from "../../../tools/observation/index.ts";
import { bus }                                    from "../../../infrastructure/events/bus.ts";
import { runToolCallVerifier }                    from "../../../verifiers/tool-call-verifier.ts";
import { runPolicyEngine, incrementToolCount }    from "../../../policies/index.ts";
import { runSecurityScan }                        from "../../../security/scanners/security-scanner.ts";

// ── Public contract ────────────────────────────────────────────────────────────

export interface ToolCallInput {
  callId:   string;
  name:     string;
  args:     string;   // raw JSON from LLM function-call arguments
  ctx:      ToolContext;
}

export interface ToolCallOutput {
  content:    string;
  isTerminal: boolean;
  execOk:     boolean;
  parsedArgs: Record<string, unknown>;
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

  // ── 2. Policy engine gate ─────────────────────────────────────────────────
  const policyReport = await runPolicyEngine({
    runId:      ctx.runId,
    projectId:  ctx.projectId,
    toolName:   name,
    command:    parsedArgs.command as string | undefined,
    filePath:   (parsedArgs.path ?? parsedArgs.filePath) as string | undefined,
    packageName: parsedArgs.packageName as string | undefined,
    retryCount: 0,
    metadata:   { stepCount: 1 },
  }).catch(() => null);

  if (policyReport?.blocked) {
    const reason = policyReport.blockReasons[0] ?? "Policy blocked";
    emitBlocked(ctx.runId, name, "policy", reason);
    return {
      content:    JSON.stringify({ ok: false, error: `[POLICY BLOCKED] ${reason}` }),
      isTerminal: false, execOk: false, parsedArgs,
    };
  }

  // ── 3. Verifier gate (pre-execution) ──────────────────────────────────────
  const verifyResult = await runToolCallVerifier([{ id: callId, name, arguments: args }]);
  if (verifyResult.blocksExecution) {
    const err = verifyResult.detail ?? verifyResult.message;
    emitBlocked(ctx.runId, name, "verifier", err);
    return { content: JSON.stringify({ ok: false, error: err }), isTerminal: false, execOk: false, parsedArgs };
  }

  // ── 4. Unknown tool guard ─────────────────────────────────────────────────
  if (!toolOrchestrator.has(name)) {
    const err = `Unknown tool: ${name}`;
    emitError(ctx.runId, name, err);
    return { content: JSON.stringify({ ok: false, error: err }), isTerminal: false, execOk: false, parsedArgs };
  }

  // ── 5. Execute ────────────────────────────────────────────────────────────
  incrementToolCount(ctx.runId, name);
  const startTs    = Date.now();
  const result     = await toolOrchestrator.execute(name, parsedArgs, ctx);
  const durationMs = Date.now() - startTs;

  // ── 6. Security scan on written code ─────────────────────────────────────
  const writtenCode = (parsedArgs.content ?? parsedArgs.code) as string | undefined;
  const writtenPath = (parsedArgs.path ?? parsedArgs.filePath) as string | undefined;
  if (writtenCode && writtenPath && result.ok) {
    const secReport = await runSecurityScan(
      writtenCode, writtenPath, ctx.runId, ctx.projectId,
    ).catch(() => null);

    if (secReport?.blocked) {
      bus.emit("agent.event", {
        runId:     ctx.runId,
        eventType: "security.blocked" as any,
        phase:     "tool-loop",
        ts:        Date.now(),
        payload:   { tool: name, findings: secReport.blockReasons.slice(0, 3) },
      });
      return {
        content: JSON.stringify({
          ok:    false,
          error: `[SECURITY BLOCKED] ${secReport.blockReasons[0] ?? "Security scan failed"}`,
        }),
        isTerminal: false, execOk: false, parsedArgs,
      };
    }
  }

  // ── 7. Observe ────────────────────────────────────────────────────────────
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
    runId, eventType: "agent.tool_call", phase: "tool-loop",
    payload: { tool, status: "error", error }, ts: Date.now(),
  });
}

function emitBlocked(runId: string, tool: string, gate: string, reason: string): void {
  bus.emit("agent.event", {
    runId,
    eventType: `${gate}.blocked` as any,
    phase:     "tool-loop",
    payload:   { tool, gate, reason },
    ts:        Date.now(),
  });
}
