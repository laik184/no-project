/**
 * server/infrastructure/runtime/runtime-manager.ts
 *
 * Manages spawned project processes.
 * Single source of truth for all running project processes.
 *
 * Process model:
 *   spawn(shell:true, detached:true) → creates a new process GROUP.
 *   stop() kills the whole group with process.kill(-pgid, signal) so that
 *   shell wrappers (npm run dev) and their node children all die together —
 *   no orphan processes, no EADDRINUSE on restart.
 */
import { spawn } from "child_process";
import net from "net";
import { bus } from "../events/bus.ts";
import type {
  RuntimeEntry,
  RuntimeStartOptions,
  RuntimeStartResult,
  RuntimeStopResult,
} from "./runtime-types.ts";

const MAX_LOG_LINES = 500;
const STARTUP_OBSERVATION_MS = 1_000;
const PORT_READY_TIMEOUT_MS = 15_000;
const PORT_READY_POLL_MS = 200;

// Port-detection patterns — scan stdout/stderr lines for a bound port.
const PORT_PATTERNS = [
  /listening on .*?:(\d{4,5})/i,
  /Local:\s+http:\/\/localhost:(\d{4,5})/i,
  /running on.*?:(\d{4,5})/i,
  /started.*?port[: ]+(\d{4,5})/i,
  /port[: ]+(\d{4,5})/i,
  /:(\d{4,5})\s*$/,
];

function isProcessAlive(pid: number | undefined): boolean {
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function canConnect(
  port: number,
  host = "127.0.0.1",
  timeoutMs = 500,
): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.createConnection({ port, host });
    let settled = false;

    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(ok);
    };

    socket.setTimeout(timeoutMs);
    socket.once("connect", () => finish(true));
    socket.once("timeout", () => finish(false));
    socket.once("error", () => finish(false));
  });
}

async function waitForPort(
  entry: ManagedEntry,
  timeoutMs = PORT_READY_TIMEOUT_MS,
): Promise<boolean> {
  if (!entry.port) return false;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() <= deadline) {
    if (
      entry.status === "crashed" ||
      entry.status === "stopped" ||
      !isProcessAlive(entry.pid)
    ) {
      return false;
    }
    if (await canConnect(entry.port)) return true;
    await new Promise((r) => setTimeout(r, PORT_READY_POLL_MS));
  }

  return false;
}

function extractPort(line: string): number | undefined {
  for (const re of PORT_PATTERNS) {
    const m = line.match(re);
    if (m) {
      const p = parseInt(m[1], 10);
      if (p > 1024 && p < 65536) return p;
    }
  }
  return undefined;
}

/** Kill a process group (negative pid) with the given signal. Swallows ESRCH. */
function killGroup(pid: number, sig: NodeJS.Signals): void {
  try {
    process.kill(-pid, sig);
  } catch {
    /* process already gone */
  }
}

type ManagedEntry = RuntimeEntry & { child?: ReturnType<typeof spawn> };

class RuntimeManager {
  private readonly processes = new Map<number, ManagedEntry>();

  init(): void {
    console.log("[runtime-manager] Initialized.");
  }

  async start(
    projectId: number,
    opts: RuntimeStartOptions,
  ): Promise<RuntimeStartResult> {
    if (this.isRunning(projectId)) {
      const entry = this.processes.get(projectId)!;
      return {
        ok: true,
        pid: entry.pid,
        port: entry.port,
        alreadyRunning: true,
      };
    }

    // Mark any previous entry as 'stopping' so its exit handler won't emit
    // process.crashed when we kill the old process group below.
    const prevEntry = this.processes.get(projectId);
    if (prevEntry) {
      prevEntry.status = "stopping";
      // Kill the old process group before starting the new one.
      if (prevEntry.pid) killGroup(prevEntry.pid, "SIGKILL");
      // Brief pause so the OS can release the port socket.
      await new Promise((r) => setTimeout(r, 600));
    }

    const entry: ManagedEntry = {
      projectId,
      status: "starting",
      command: opts.command,
      startedAt: Date.now(),
      restartCount: (prevEntry?.restartCount ?? -1) + 1,
      logs: [],
      port: opts.port,
    };

    this.processes.set(projectId, entry);

    try {
      // detached:true — creates a new process group (pgid = child.pid).
      // This lets us kill npm + node children together via process.kill(-pgid).
      const child = spawn(opts.command, [], {
        env: { ...process.env, ...(opts.env ?? {}) },
        stdio: ["ignore", "pipe", "pipe"],
        shell: true,
        detached: true,
        ...(opts.cwd ? { cwd: opts.cwd } : {}),
      });

      // Do NOT unref() — we want to monitor the process.
      entry.pid = child.pid;
      entry.child = child;

      child.on("error", (err) => {
        console.error(
          `[runtime-manager] spawn error for project ${projectId}:`,
          err.message,
        );
        entry.status = "crashed";
        entry.child = undefined;
        bus.emit("process.crashed", {
          projectId,
          code: -1,
          logs: [...entry.logs],
        });
      });

      const appendLog = (data: Buffer) => {
        const line = data.toString().trimEnd();
        if (!line) return;
        entry.logs.push(line);
        if (entry.logs.length > MAX_LOG_LINES) entry.logs.shift();

        // Auto-detect port from process output if not already known.
        if (!entry.port) {
          const detected = extractPort(line);
          if (detected) {
            entry.port = detected;
            console.log(
              `[runtime-manager] project ${projectId} port detected: ${detected}`,
            );
            bus.emit(
              "runtime.port_detected" as never,
              { projectId, port: detected } as never,
            );
          }
        }
      };

      child.stdout?.on("data", appendLog);
      child.stderr?.on("data", appendLog);

      child.on("exit", (code, signal) => {
        // Intentional: SIGTERM/SIGKILL sent by us, or entry was already 'stopping'.
        const intentional =
          signal === "SIGTERM" ||
          signal === "SIGKILL" ||
          entry.status === "stopping";
        entry.status = code === 0 || intentional ? "stopped" : "crashed";
        entry.child = undefined;

        bus.emit(
          "process.exited" as never,
          {
            projectId,
            code: code ?? null,
            signal: signal ?? null,
            status: entry.status,
          } as never,
        );

        if (!intentional && code !== 0) {
          bus.emit("process.crashed", {
            projectId,
            code: code ?? -1,
            logs: [...entry.logs],
          });
        }
      });

      await new Promise((r) => setTimeout(r, STARTUP_OBSERVATION_MS));
      if (
        entry.status === "crashed" ||
        entry.status === "stopped" ||
        !isProcessAlive(child.pid)
      ) {
        entry.status = entry.status === "starting" ? "crashed" : entry.status;
        return {
          ok: false,
          pid: child.pid,
          port: entry.port,
          error:
            entry.logs.slice(-20).join("\n") ||
            `Runtime process exited before becoming observable: ${opts.command}`,
        };
      }

      if (entry.port) {
        const portOpen = await waitForPort(entry);
        if (!portOpen) {
          entry.status = "crashed";
          if (entry.pid) killGroup(entry.pid, "SIGTERM");
          return {
            ok: false,
            pid: child.pid,
            port: entry.port,
            error: `Runtime process started but port ${entry.port} did not open within ${PORT_READY_TIMEOUT_MS}ms.`,
          };
        }
      }

      entry.status = "running";
      bus.emit(
        "process.started" as never,
        { projectId, pid: child.pid, port: entry.port } as never,
      );
      return { ok: true, pid: child.pid, port: entry.port };
    } catch (err) {
      entry.status = "crashed";
      return {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  stop(projectId: number): RuntimeStopResult {
    const entry = this.processes.get(projectId);
    if (!entry)
      return { ok: false, error: `No process for project ${projectId}` };

    try {
      entry.status = "stopping";

      if (entry.pid) {
        // Kill the entire process group — this kills npm + node children together.
        killGroup(entry.pid, "SIGTERM");
        // Follow up with SIGKILL after a short grace period for stubborn processes.
        setTimeout(() => killGroup(entry.pid!, "SIGKILL"), 1500);
      }

      return { ok: true };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  async restart(
    projectId: number,
    opts: Omit<RuntimeStartOptions, "port">,
  ): Promise<RuntimeStartResult> {
    const prevPort = this.processes.get(projectId)?.port;
    this.stop(projectId);
    // Wait for process group to fully exit before restarting.
    await new Promise<void>((resolve) => {
      const entry = this.processes.get(projectId);
      const child = (entry as ManagedEntry | undefined)?.child;
      if (!child) {
        setTimeout(resolve, 300);
        return;
      }
      child.once("exit", () => setTimeout(resolve, 300));
      setTimeout(resolve, 3000); // hard fallback
    });
    return this.start(projectId, { ...opts, port: prevPort });
  }

  get(projectId: number): RuntimeEntry | undefined {
    return this.processes.get(projectId);
  }

  all(): RuntimeEntry[] {
    return [...this.processes.values()];
  }

  isRunning(projectId: number): boolean {
    const entry = this.processes.get(projectId);
    return Boolean(
      entry &&
      (entry.status === "running" || entry.status === "starting") &&
      isProcessAlive(entry.pid),
    );
  }

  isProcessAlive(projectId: number): boolean {
    return isProcessAlive(this.processes.get(projectId)?.pid);
  }

  async isPortOpen(projectId: number): Promise<boolean> {
    const entry = this.processes.get(projectId);
    return Boolean(entry?.port && (await canConnect(entry.port)));
  }
}

export const runtimeManager = new RuntimeManager();
