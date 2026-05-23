/**
 * server/infrastructure/process/process-registry-spawn.ts
 *
 * _doStart implementation — full process spawn lifecycle.
 * Extracted from process-registry.ts to keep each file ≤250 lines.
 *
 * Single responsibility: sandbox process spawning only.
 */

import { spawn }    from "child_process";
import { bus }      from "../events/bus.ts";
import { findFreePort } from "../runtime/port-manager.ts";
import {
  parseAndValidateRuntimeCommand,
  emitSpawnStarted,
  emitSpawnFailed,
} from "../../security/runtime-command-policy/index.ts";
import { captureService } from "../../console/capture/capture.service.ts";
import type { ProcessEntry, StartOptions, StartResult } from "./process-types.ts";

const MAX_LOGS = 200;

export function emitProcessEvent(type: string, projectId: number, payload: unknown): void {
  bus.emit("agent.event", {
    runId: `runtime-${projectId}`, projectId,
    phase: "runtime", eventType: type as any, payload, ts: Date.now(),
  });
}

/**
 * Spawn a new process for the given project.
 * Returns immediately if already running.
 * Validates command before spawn (fail-closed).
 */
export async function spawnProcess(
  opts:    StartOptions,
  entries: Map<number, ProcessEntry>,
  onSetStatus:   (projectId: number, status: ProcessEntry["status"]) => void,
  onScheduleSave: () => void,
): Promise<StartResult> {
  const { projectId, cwd, env } = opts;
  const command = opts.command ?? "npm run dev";

  const existing = entries.get(projectId);
  if (existing && (existing.status === "running" || existing.status === "starting"))
    return { ok: true, alreadyRunning: true, port: existing.port, pid: existing.pid };

  let port: number;
  try { port = await findFreePort(); }
  catch { return { ok: false, error: "Could not allocate a free port" }; }

  const validated = parseAndValidateRuntimeCommand(command, projectId);
  if (!validated.ok || !validated.parsed) {
    emitSpawnFailed(command, validated.reason ?? "command validation failed", projectId);
    return { ok: false, error: validated.reason ?? "command blocked by security policy" };
  }

  const { cmd, args: cmdArgs } = validated.parsed;
  const logs: string[] = [];
  const proc = spawn(cmd, cmdArgs, {
    cwd, shell: false, detached: false,
    env: { ...process.env, PORT: String(port), NODE_ENV: "development", ...env },
  });

  if (!proc.pid) {
    emitSpawnFailed(cmd, "no PID after spawn", projectId);
    return { ok: false, error: "Failed to spawn process — no PID" };
  }

  emitSpawnStarted(cmd, proc.pid, port, projectId);

  const now = Date.now();
  entries.set(projectId, {
    projectId, pid: proc.pid, port, status: "starting",
    process: proc, logs, startedAt: now,
    command, cwd, restartCount: existing?.restartCount ?? 0,
    lastHeartbeat: now, lastActivity: now,
  });

  if (proc.stdout && proc.stderr) {
    captureService.attach({
      processId: `project-${projectId}-${proc.pid}`, projectId,
      stdout: proc.stdout, stderr: proc.stderr,
    });
  }

  const updateActivity = () => {
    const e = entries.get(projectId);
    if (e) entries.set(projectId, { ...e, lastActivity: Date.now() });
  };

  proc.stdout?.on("data", (d: Buffer) => {
    const line = d.toString().trimEnd();
    logs.push(line); if (logs.length > MAX_LOGS) logs.shift();
    updateActivity();
    bus.emit("console.log", { projectId, stream: "stdout", line, ts: Date.now() });
    if (entries.get(projectId)?.status === "starting") onSetStatus(projectId, "running");
  });

  proc.stderr?.on("data", (d: Buffer) => {
    const line = d.toString().trimEnd();
    logs.push(`[stderr] ${line}`); if (logs.length > MAX_LOGS) logs.shift();
    updateActivity();
    bus.emit("console.log", { projectId, stream: "stderr", line, ts: Date.now() });
  });

  proc.on("exit", (code) => {
    const crashed = code !== 0 && code !== null;
    onSetStatus(projectId, crashed ? "crashed" : "stopped");
    emitProcessEvent(crashed ? "process.crashed" : "process.stopped", projectId, { code, port });
    onScheduleSave();
    setTimeout(() => entries.delete(projectId), 3_000);
  });

  proc.on("error", (err) => {
    onSetStatus(projectId, "crashed");
    emitProcessEvent("process.crashed", projectId, { error: err.message });
    onScheduleSave();
  });

  emitProcessEvent("process.started", projectId, { pid: proc.pid, port, command });
  onScheduleSave();
  return { ok: true, pid: proc.pid, port };
}
