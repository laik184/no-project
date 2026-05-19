/**
 * IQ 2000 — Console Orchestrator
 *
 * Master coordinator for the entire console pipeline.
 * Owns the capture → filter → persist → stream data flow and
 * exposes the only public surface that other server modules should touch.
 *
 * Pipeline wiring (single data path):
 *
 *   Child Process stdout/stderr
 *        │
 *        ▼
 *   [capture] captureService.attach()
 *        │  emits ConsoleLine via onLine()
 *        ▼
 *   [filter]  filterService.processRaw()         ← already applied inside captureService
 *        │
 *        ├──▶ [persist] persistService.enqueue()  ← async batch write to DB
 *        │
 *        └──▶ [stream]  streamService.broadcast() ← push to all SSE clients
 *
 * External API (via consolePipeline singleton in index.ts):
 *   - attach(opts)               attach to a child process
 *   - detach(processId)          clean up when process exits
 *   - injectSystem(id, msg)      inject synthetic system line
 *   - getHealth()                aggregate health of all modules
 *   - on(listener)               subscribe to pipeline events
 */

import { captureService } from './capture/capture.service.ts';
import { streamService }  from './stream/stream.service.ts';
import { persistService } from './persist/persist.service.ts';
import { historyService } from './history/history.service.ts';
import { filterService }  from './filter/filter.service.ts';
import { bus }            from '../infrastructure/events/bus.ts';

import type {
  AttachOptions,
  ConsoleLine,
  ConsoleHealth,
  OrchestratorStatus,
  PipelineEvent,
  PipelineEventListener,
} from './types.ts';

export class ConsoleOrchestrator {
  private status: OrchestratorStatus = 'idle';
  private startedAt: Date = new Date();
  private listeners = new Set<PipelineEventListener>();
  private initialized = false;
  private lineCount = 0;

  // ─── Boot ────────────────────────────────────────────────────────────────

  /**
   * Wire the capture → persist + stream pipeline.
   * Called once by the Pipeline Controller on server start.
   */
  init(): void {
    if (this.initialized) return;
    this.status = 'initializing';

    this.wireCaptureToDownstream();

    this.status = 'ready';
    this.initialized = true;
  }

  // ─── Public API ──────────────────────────────────────────────────────────

  /**
   * Attach the console pipeline to a running child process.
   * Once attached, every stdout/stderr byte is captured, classified,
   * persisted, and streamed to all connected browser clients.
   */
  attach(opts: AttachOptions): void {
    captureService.attach(opts);
    this.emit({ type: 'process-attached', payload: { processId: opts.processId, projectId: opts.projectId } });
  }

  /**
   * Detach bookkeeping for a process after it exits.
   */
  detach(processId: string): void {
    captureService.detach(processId);
    this.emit({ type: 'process-detached', payload: { processId } });
  }

  /**
   * Inject a synthetic system-level line directly into the pipeline
   * (skips capture, goes straight to filter → persist → stream).
   */
  injectSystem(projectId: number, text: string): void {
    captureService.injectSystem(projectId, text);
  }

  /**
   * Push a pre-built ConsoleLine directly into persist + stream
   * (useful for agent-generated messages that don't come from stdio).
   */
  push(line: ConsoleLine): void {
    this.routeLine(line);
  }

  // ─── Health ──────────────────────────────────────────────────────────────

  getHealth(): ConsoleHealth {
    const captureSnap = captureService.getSnapshot();
    const streamSnap  = streamService.getSnapshot();

    const modules: ConsoleHealth['modules'] = {
      capture: {
        ok: true,
        details: `${captureSnap.attached.length} process(es) attached, ${captureSnap.totalCaptured} lines captured`,
      },
      filter: {
        ok: true,
        details: `${filterService.getRules().length} rules active`,
      },
      persist: {
        ok: true,
        details: 'batch writer running',
      },
      stream: {
        ok: true,
        details: `${streamSnap.clientCount} SSE client(s)`,
      },
      history: {
        ok: true,
        details: 'DB-backed history ready',
      },
    };

    const allOk = Object.values(modules).every((m) => m.ok);

    return {
      status: allOk ? this.status : 'degraded',
      modules,
      uptime: Math.floor((Date.now() - this.startedAt.getTime()) / 1000),
      startedAt: this.startedAt,
    };
  }

  // ─── Event Bus ───────────────────────────────────────────────────────────

  on(listener: PipelineEventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(event: Omit<PipelineEvent, 'timestamp'>): void {
    const full: PipelineEvent = { ...event, timestamp: new Date() };
    for (const listener of this.listeners) {
      try { listener(full); } catch {}
    }
  }

  // ─── Internal wiring ─────────────────────────────────────────────────────

  /**
   * Subscribe to capture output and fan each line to persist + stream.
   * This is the single cross-module wiring point — nothing else connects
   * these services directly.
   */
  private wireCaptureToDownstream(): void {
    captureService.onLine((line: ConsoleLine) => {
      this.routeLine(line);
    });

    // ── Bus bridge ────────────────────────────────────────────────────────
    // processRegistry emits console.log directly to the bus (bypassing
    // captureService).  This listener catches those events and routes them
    // through the full IQ2000 persist → stream pipeline so DB writes and
    // SSE fan-out actually happen.  We intentionally skip bus re-emission
    // here (routeLine already does that) to prevent an infinite loop.
    bus.on('console.log', (e) => {
      const line: ConsoleLine = {
        id:        `bus-${e.projectId}-${e.ts}`,
        projectId: e.projectId,
        kind:      e.stream === 'stderr' ? 'stderr' : 'stdout',
        text:      e.line,
        ts:        new Date(e.ts),
      };

      if (line.kind === 'stderr') {
        persistService.persistNow(line).catch(() => {});
      } else {
        persistService.enqueue(line);
      }

      streamService.broadcast(line);
      this.lineCount++;
    });
  }

  private routeLine(line: ConsoleLine): void {
    this.lineCount++;

    // Persist: batch-write to DB (high-priority lines go immediately)
    if (line.kind === 'error') {
      persistService.persistNow(line).catch(() => {});
    } else {
      persistService.enqueue(line);
    }

    // Stream: fan-out to all SSE clients watching this project
    streamService.broadcast(line);

    // Bridge to global EventBus so /sse/console and all bus subscribers receive logs
    bus.emit('console.log', {
      projectId: line.projectId,
      stream:    line.kind === 'stderr' || line.kind === 'error' ? 'stderr' : 'stdout',
      line:      line.text,
      ts:        line.ts.getTime(),
    });

    this.emit({
      type: 'line-streamed',
      payload: { projectId: line.projectId, kind: line.kind, lineCount: this.lineCount },
    });
  }

  // ─── Graceful Shutdown ───────────────────────────────────────────────────

  dispose(): void {
    this.status = 'shutting-down';
    persistService.dispose();
    streamService.dispose();
    this.listeners.clear();
  }
}

export const consoleOrchestrator = new ConsoleOrchestrator();
