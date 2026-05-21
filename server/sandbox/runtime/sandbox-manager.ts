/**
 * server/sandbox/runtime/sandbox-manager.ts
 * Manages sandbox lifecycle — create, run, terminate.
 * Single responsibility: sandbox orchestration. No policy logic.
 */

import { v4 as uuid }           from "uuid";
import { validateCommand }       from "./command-whitelist.ts";
import { guardFilesystem }       from "../filesystem/filesystem-guard.ts";
import { limitProcess }          from "./process-limiter.ts";
import { monitorResources }      from "../security/resource-monitor.ts";
import { bus }                   from "../../infrastructure/events/bus.ts";
import type {
  SandboxConstraints,
  SandboxExecutionRequest,
  SandboxExecutionResult,
  SandboxReport,
  SandboxStatus,
} from "../types.ts";

const DEFAULT_TIMEOUT_MS  = 30_000;
const DEFAULT_MEMORY_MB   = 512;
const DEFAULT_CPU_PERCENT = 80;

const activeSandboxes = new Map<string, SandboxConstraints>();

export function createSandbox(projectId: number, rootPath: string): string {
  const sandboxId = uuid();
  const constraints: SandboxConstraints = {
    projectId,
    rootPath,
    allowedPaths:   [rootPath],
    maxCpuPercent:  DEFAULT_CPU_PERCENT,
    maxMemoryMb:    DEFAULT_MEMORY_MB,
    maxProcesses:   20,
    networkAllowed: true,
    allowedHosts:   ["registry.npmjs.org", "openrouter.ai", "api.openai.com"],
    timeoutMs:      DEFAULT_TIMEOUT_MS,
  };
  activeSandboxes.set(sandboxId, constraints);
  return sandboxId;
}

export async function executeSandboxed(
  req: SandboxExecutionRequest,
): Promise<SandboxExecutionResult> {
  const constraints = activeSandboxes.get(req.sandboxId);
  if (!constraints) {
    return errorResult(req, "Sandbox not found — must call createSandbox first.");
  }

  // 1. Command whitelist check
  const cmdCheck = validateCommand(req.command);
  if (cmdCheck.blocked) {
    emitSandboxBlocked(req, cmdCheck.reason ?? "command blocked");
    return blockedResult(req, cmdCheck.reason ?? "Command blocked by whitelist.");
  }

  // 2. Filesystem scope check
  const fsCheck = guardFilesystem(req.cwd, constraints.rootPath);
  if (fsCheck.blocked) {
    emitSandboxBlocked(req, fsCheck.reason);
    return blockedResult(req, fsCheck.reason);
  }

  // 3. Run with process limits
  const start = Date.now();
  const result = await limitProcess(req, constraints);

  // 4. Resource monitoring post-run
  await monitorResources(req.sandboxId, constraints);

  return { ...result, durationMs: Date.now() - start };
}

export function destroySandbox(sandboxId: string): void {
  activeSandboxes.delete(sandboxId);
}

export function getSandboxReport(sandboxId: string): SandboxReport | null {
  const c = activeSandboxes.get(sandboxId);
  if (!c) return null;
  return {
    sandboxId,
    projectId:       c.projectId,
    isolated:        true,
    resourceUsage:   { cpuPercent: 0, memoryMb: 0, processes: 0, networkBytes: 0 },
    blockedCommands: [],
    networkAccess:   c.networkAllowed,
    filesystemScope: c.rootPath,
    runtimeHealth:   "running" as SandboxStatus,
  };
}

function blockedResult(req: SandboxExecutionRequest, reason: string): SandboxExecutionResult {
  return { sandboxId: req.sandboxId, exitCode: 1, stdout: "", stderr: reason,
    durationMs: 0, blocked: true, blockReason: reason, timedOut: false };
}

function errorResult(req: SandboxExecutionRequest, reason: string): SandboxExecutionResult {
  return { sandboxId: req.sandboxId, exitCode: -1, stdout: "", stderr: reason,
    durationMs: 0, blocked: true, blockReason: reason, timedOut: false };
}

function emitSandboxBlocked(req: SandboxExecutionRequest, reason: string): void {
  bus.emit("agent.event", {
    runId: req.sandboxId, eventType: "sandbox.blocked" as any,
    phase: "execution", ts: Date.now(), payload: { command: req.command, reason },
  });
}
