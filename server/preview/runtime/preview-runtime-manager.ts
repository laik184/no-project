/**
 * preview-runtime-manager.ts — Orchestrates start/stop/restart for preview processes.
 * Bridges infrastructure runtimeManager with preview lifecycle.
 */

import { runtimeManager } from "../../infrastructure/index.ts";
import { lifecycleManager } from "../lifecycle/preview-lifecycle-manager.ts";
import { healthMonitor } from "./preview-health-monitor.ts";
import { previewReloader } from "./preview-reloader.ts";
import { bus } from "../../infrastructure/index.ts";
import net from "net";

export interface PreviewStartOptions {
  command: string;
  port?: number;
  cwd?: string;
  env?: Record<string, string>;
}

// How long to wait for a detected port to become reachable before marking ready.
const PORT_WAIT_MS = 15_000;
const PORT_POLL_MS = 200;

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

class PreviewRuntimeManager {
  async start(
    projectId: number,
    opts: PreviewStartOptions,
  ): Promise<{ ok: boolean; error?: string }> {
    await lifecycleManager.markStarting(projectId);

    const result = await runtimeManager.start(projectId, {
      command: opts.command,
      port: opts.port,
      cwd: opts.cwd,
      env: opts.env,
    });

    if (!result.ok) {
      await lifecycleManager.markCrashed(projectId, null);
      return { ok: false, error: result.error };
    }

    await lifecycleManager.markVerifying(projectId);
    healthMonitor.start(projectId);

    // Wait for a verified open port (up to PORT_WAIT_MS), then mark ready.
    this._waitForPortAndMarkReady(projectId);

    return { ok: true };
  }

  private _waitForPortAndMarkReady(projectId: number): void {
    const deadline = Date.now() + PORT_WAIT_MS;
    let unsubscribe: (() => void) | null = null;

    const markReadyIfReachable = async (port: number | null) => {
      if (!port) return false;
      const entry = runtimeManager.get(projectId);
      if (!entry || entry.status === "crashed" || entry.status === "stopped") {
        await lifecycleManager
          .markCrashed(projectId, null)
          .catch(console.error);
        return true;
      }
      if (!(await canConnect(port))) return false;
      if (unsubscribe) {
        unsubscribe();
        unsubscribe = null;
      }
      await lifecycleManager.markReady(projectId, port).catch(console.error);
      return true;
    };

    const markCrashed = async (message: string) => {
      if (unsubscribe) {
        unsubscribe();
        unsubscribe = null;
      }
      await lifecycleManager.markCrashed(projectId, null).catch(console.error);
      console.error(`[preview-runtime] ${message}`);
    };

    // Subscribe to bus port_detected event.
    const handler = (payload: Record<string, unknown>) => {
      if ((payload.projectId as number) !== projectId) return;
      void markReadyIfReachable(payload.port as number);
    };
    bus.on("runtime.port_detected" as never, handler as never);
    unsubscribe = () =>
      bus.off("runtime.port_detected" as never, handler as never);

    // Polling fallback: if port was detected synchronously (fast startup),
    // wait until it is reachable. If the deadline passes, mark crashed.
    const poll = setInterval(async () => {
      const entry = runtimeManager.get(projectId);

      // If the process disappears before a reachable port is verified, the
      // preview cannot become visible. Non-zero exits are also bridged by
      // lifecycle-events.ts, but zero-code early exits only emit process.exited;
      // mark them crashed here to avoid an infinite fake "verifying" state.
      if (!entry || entry.status === "crashed" || entry.status === "stopped") {
        clearInterval(poll);
        await markCrashed(
          `Project ${projectId} exited before exposing a reachable preview port.`,
        );
        return;
      }

      // Port was detected — mark ready only after a real TCP connection succeeds.
      if (entry.port && (await markReadyIfReachable(entry.port))) {
        clearInterval(poll);
        return;
      }

      // Deadline reached — do not report fake readiness without a reachable port.
      if (Date.now() >= deadline) {
        clearInterval(poll);
        await markCrashed(
          `Project ${projectId} never exposed a reachable preview port within ${PORT_WAIT_MS}ms.`,
        );
      }
    }, PORT_POLL_MS);
  }

  async stop(projectId: number): Promise<void> {
    healthMonitor.stop(projectId);
    runtimeManager.stop(projectId);
    await lifecycleManager.reset(projectId);
  }

  async restart(
    projectId: number,
    opts: PreviewStartOptions,
  ): Promise<{ ok: boolean; error?: string }> {
    await lifecycleManager.markRestarting(projectId);
    healthMonitor.stop(projectId);

    // Use runtimeManager.restart — it waits for child exit + frees the port.
    // Pass only non-port options; restart() preserves the existing port.
    const result = await runtimeManager.restart(projectId, {
      command: opts.command,
      cwd: opts.cwd,
      env: opts.env,
    });

    if (!result.ok) {
      await lifecycleManager.markCrashed(projectId, null);
      return { ok: false, error: result.error };
    }

    previewReloader.triggerServerRestart(projectId);
    await lifecycleManager.markVerifying(projectId);
    healthMonitor.start(projectId);
    this._waitForPortAndMarkReady(projectId);
    return { ok: true };
  }

  isRunning(projectId: number): boolean {
    const entry = runtimeManager.get(projectId);
    return entry?.status === "running";
  }

  getPort(projectId: number): number | null {
    return runtimeManager.get(projectId)?.port ?? null;
  }
}

export const previewRuntimeManager = new PreviewRuntimeManager();
