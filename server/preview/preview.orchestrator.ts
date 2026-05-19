/**
 * IQ2000 — Preview Orchestrator
 *
 * Central coordinator for all preview subsystems.
 * Owns service lifecycle, cross-module wiring, and health aggregation.
 * Pipeline Controller (index.ts) delegates to this class exclusively.
 */

import { runtimeService } from './runtime/runtime.service.ts';
import { filesService } from './files/files.service.ts';
import { tunnelService } from './tunnel/tunnel.service.ts';
import { devtoolsService } from './devtools/devtools.service.ts';
import { stateService } from './state/state.service.ts';
import { mountLifecycleBridge } from './lifecycle/preview-lifecycle-bridge.ts';
import { getLifecycleManager } from './lifecycle/preview-lifecycle.manager.ts';
import type { ProjectProcess, RunResult, StopResult, RestartResult } from './runtime/runtime.types.ts';
import type { PreviewState } from './state/state.types.ts';

export type OrchestratorStatus = 'idle' | 'initializing' | 'ready' | 'degraded' | 'shutting-down';

export interface OrchestratorHealth {
  status: OrchestratorStatus;
  modules: Record<string, { ok: boolean; details?: string }>;
  uptime: number;
  startedAt: Date;
}

export interface PipelineEvent {
  type: 'project-started' | 'project-stopped' | 'project-error' | 'project-restarted' | 'state-changed' | 'reload-triggered';
  payload: Record<string, unknown>;
  timestamp: Date;
}

type EventListener = (event: PipelineEvent) => void;

export class PreviewOrchestrator {
  private status: OrchestratorStatus = 'idle';
  private startedAt: Date = new Date();
  private listeners = new Set<EventListener>();
  private initialized = false;

  /**
   * Boot sequence — wire cross-module callbacks and start background tasks.
   * Called once by the Pipeline Controller on server start.
   */
  init(): void {
    if (this.initialized) return;
    this.status = 'initializing';

    this.wireRuntimeEvents();
    this.wireStateEvents();
    mountLifecycleBridge();

    this.status = 'ready';
    this.initialized = true;
  }

  // ─── Runtime Pipeline ──────────────────────────────────────────────────────

  async startProject(
    id: string,
    projectPath: string,
    options?: { command?: string; port?: number; env?: Record<string, string> }
  ): Promise<RunResult> {
    const numId = parseInt(id, 10) || 0;
    getLifecycleManager(numId).forceTransition('starting', `Starting "${id}"…`);

    const result = await runtimeService.run({ id, projectPath, ...options });

    if (result.ok) {
      const tunnelInfo = tunnelService.getTunnelInfo();
      // Use the preview proxy path so the iframe always routes through
      // preview-proxy.ts → runtimeManager.get(projectId).port (the real
      // dynamically-allocated port).  Pointing directly to tunnelInfo.url
      // would hardcode port 5000 and cause a desync with the actual process.
      const previewUrl = tunnelInfo.isReplit && tunnelInfo.domain
        ? `https://${tunnelInfo.domain}/preview/${id}`
        : `http://localhost:${result.port}`;
      stateService.setUrl(previewUrl);
      devtoolsService.pushConsoleLog({
        type: 'info',
        message: `[IQ2000] Project "${id}" started on port ${result.port}`,
        source: 'orchestrator',
        projectId: id,
      });
      getLifecycleManager(numId).forceTransition('ready', `Server ready on port ${result.port}.`, { port: result.port });
      this.emit({ type: 'project-started', payload: { id, port: result.port, pid: result.pid } });
    } else {
      devtoolsService.pushConsoleLog({
        type: 'error',
        message: `[IQ2000] Failed to start "${id}": ${result.error}`,
        source: 'orchestrator',
        projectId: id,
      });
      getLifecycleManager(numId).forceTransition('crashed', result.error ?? 'Failed to start.', { error: result.error });
      this.emit({ type: 'project-error', payload: { id, error: result.error } });
    }

    return result;
  }

  async stopProject(id: string): Promise<StopResult> {
    const result = await runtimeService.stop({ id });

    if (result.ok) {
      devtoolsService.pushConsoleLog({
        type: 'warn',
        message: `[IQ2000] Project "${id}" stopped`,
        source: 'orchestrator',
        projectId: id,
      });
      const numId = parseInt(id, 10) || 0;
      getLifecycleManager(numId).forceTransition('idle', 'Project stopped.');
      this.emit({ type: 'project-stopped', payload: { id } });
    }

    return result;
  }

  async restartProject(
    id: string,
    projectPath: string,
    options?: { command?: string; port?: number }
  ): Promise<RestartResult> {
    const numId = parseInt(id, 10) || 0;
    getLifecycleManager(numId).forceTransition('restarting', `Restarting "${id}"…`);

    devtoolsService.pushConsoleLog({
      type: 'info',
      message: `[IQ2000] Restarting "${id}"...`,
      source: 'orchestrator',
      projectId: id,
    });

    const result = await runtimeService.restart({ id, projectPath, ...options });

    if (result.ok) {
      devtoolsService.signalReload();
      getLifecycleManager(numId).forceTransition('ready', 'Restart complete.', { reloadType: result.reloadType });
      this.emit({ type: 'project-restarted', payload: { id, reloadType: result.reloadType } });
    } else {
      getLifecycleManager(numId).forceTransition('crashed', result.error ?? 'Restart failed.', { error: result.error });
      this.emit({ type: 'project-error', payload: { id, error: result.error } });
    }

    return result;
  }

  // ─── State Pipeline ────────────────────────────────────────────────────────

  syncStateToDevtools(state: PreviewState): void {
    devtoolsService.broadcast(
      { type: 'preview', data: state },
      'preview'
    );
    this.emit({ type: 'state-changed', payload: { state } });
  }

  triggerReload(): void {
    devtoolsService.signalReload();
    this.emit({ type: 'reload-triggered', payload: { ts: Date.now() } });
  }

  // ─── Health Aggregation ────────────────────────────────────────────────────

  getHealth(): OrchestratorHealth {
    const runtimeStatus = runtimeService.getStatus();
    const tunnelInfo = tunnelService.getTunnelInfo();
    const devtoolsSnap = devtoolsService.getSnapshot();
    const stateResult = stateService.get();

    const modules = {
      runtime: {
        ok: true,
        details: `${runtimeStatus.running.filter(p => p.status === 'running').length} running`,
      },
      files: { ok: true, details: 'filesystem ready' },
      tunnel: {
        ok: tunnelInfo.ok,
        details: tunnelInfo.domain ?? 'local-only',
      },
      devtools: {
        ok: true,
        details: `${devtoolsSnap.clientCount} SSE clients`,
      },
      state: {
        ok: stateResult.ok,
        details: stateResult.state?.sessionId ?? 'no-session',
      },
    };

    const allOk = Object.values(modules).every(m => m.ok);

    return {
      status: allOk ? this.status : 'degraded',
      modules,
      uptime: Math.floor((Date.now() - this.startedAt.getTime()) / 1000),
      startedAt: this.startedAt,
    };
  }

  // ─── Event Bus ─────────────────────────────────────────────────────────────

  on(listener: EventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(event: Omit<PipelineEvent, 'timestamp'>): void {
    const full: PipelineEvent = { ...event, timestamp: new Date() };
    for (const listener of this.listeners) {
      try { listener(full); } catch {}
    }
  }

  // ─── Cross-Module Wiring ───────────────────────────────────────────────────

  private wireRuntimeEvents(): void {
    runtimeService['events'] = {
      onStart: (proc: ProjectProcess) => {
        devtoolsService.pushConsoleLog({
          type: 'info',
          message: `Process started: pid=${proc.pid} port=${proc.port}`,
          source: 'runtime',
          projectId: proc.id,
        });
      },
      onStop: (id: string) => {
        devtoolsService.pushConsoleLog({
          type: 'warn',
          message: `Process exited: id=${id}`,
          source: 'runtime',
          projectId: id,
        });
      },
      onError: (id: string, error: Error) => {
        devtoolsService.pushConsoleLog({
          type: 'error',
          message: `Process error [${id}]: ${error.message}`,
          source: 'runtime',
          projectId: id,
        });
      },
      onRestart: (id: string) => {
        devtoolsService.signalReload();
      },
    };
  }

  private wireStateEvents(): void {
    stateService.onBroadcast((state: PreviewState) => {
      this.syncStateToDevtools(state);
    });
  }

  // ─── Graceful Shutdown ─────────────────────────────────────────────────────

  dispose(): void {
    this.status = 'shutting-down';
    runtimeService.dispose();
    devtoolsService.dispose();
    this.listeners.clear();
  }
}

export const previewOrchestrator = new PreviewOrchestrator();
