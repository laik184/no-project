/**
 * server/sandbox/runtime/execution-isolator.ts
 * Top-level isolator — runs full sandbox validation pipeline before execution.
 * Single responsibility: coordinate sandbox checks. No business logic.
 */

import { validateCommand }     from "./command-whitelist.ts";
import { guardFilesystem }     from "../filesystem/filesystem-guard.ts";
import { checkNetworkAccess }  from "../security/network-policy.ts";
import { applySandboxPolicy }  from "../../policies/security/sandbox-policy.ts";
import { bus }                 from "../../infrastructure/events/bus.ts";
import type { SandboxConstraints, SandboxExecutionRequest, SandboxExecutionResult } from "../types.ts";

export interface IsolationDecision {
  allowed:     boolean;
  violations:  string[];
  sandboxId:   string;
}

export async function isolateAndValidate(
  req:         SandboxExecutionRequest,
  constraints: SandboxConstraints,
): Promise<IsolationDecision> {
  const violations: string[] = [];

  // 1. Command whitelist
  const cmdCheck = validateCommand(req.command);
  if (cmdCheck.blocked) violations.push(`[COMMAND] ${cmdCheck.reason}`);

  // 2. Filesystem scope
  const fsCheck = guardFilesystem(req.cwd, constraints.rootPath);
  if (fsCheck.blocked) violations.push(`[FILESYSTEM] ${fsCheck.reason}`);

  // 3. Policy engine check
  const policyResult = applySandboxPolicy({
    runId:     req.sandboxId,
    projectId: req.projectId,
    command:   req.command,
    filePath:  req.cwd,
  });
  if (policyResult.decision === "block") {
    violations.push(`[POLICY] ${policyResult.reason}`);
  }

  // 4. Network check (extract URLs from command if present)
  const urlMatch = req.command.match(/https?:\/\/[^\s"']+/g) ?? [];
  for (const url of urlMatch) {
    const netCheck = checkNetworkAccess(url, constraints.allowedHosts);
    if (!netCheck.allowed) violations.push(`[NETWORK] ${netCheck.reason}`);
  }

  const allowed = violations.length === 0;

  if (!allowed) {
    bus.emit("agent.event", {
      runId: req.sandboxId, eventType: "sandbox.blocked" as any,
      phase: "execution", ts: Date.now(),
      payload: { violations, command: req.command },
    });
  }

  return { allowed, violations, sandboxId: req.sandboxId };
}

export function buildBlockedResult(
  req:        SandboxExecutionRequest,
  violations: string[],
): SandboxExecutionResult {
  return {
    sandboxId:   req.sandboxId,
    exitCode:    1,
    stdout:      "",
    stderr:      `Execution blocked:\n${violations.join("\n")}`,
    durationMs:  0,
    blocked:     true,
    blockReason: violations[0] ?? "Sandbox isolation violation",
    timedOut:    false,
  };
}
