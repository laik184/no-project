/**
 * IQ 2000 — Console Orchestrator
 *
 * Wires: processRegistry → bus → intelligence parsers → state machine → persist + stream.
 * Single data path. All cross-module connections live here — nothing else links services directly.
 */

import { captureService } from './capture/capture.service.ts';
import { streamService }  from './stream/stream.service.ts';
import { persistService } from './persist/persist.service.ts';
import { historyService } from './history/history.service.ts';
import { filterService }  from './filter/filter.service.ts';
import { bus }            from '../infrastructure/events/bus.ts';
import { parseNpm }       from './intelligence/npm-parser.ts';
import { parseVite }      from './intelligence/vite-parser.ts';
import { parseNode }      from './intelligence/node-parser.ts';
import { runtimeStates }  from './runtime/runtime-states.ts';
import { commandLifecycle } from './runtime/command-lifecycle.ts';

import type {
  AttachOptions,
  ConsoleLine,
  ConsoleHealth,
  ConsoleLineMeta,
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

  init(): void {
    if (this.initialized) return;
    this.status = 'initializing';
    this.wireCaptureToDownstream();
    this.status = 'ready';
    this.initialized = true;
  }

  // ─── Public API ──────────────────────────────────────────────────────────

  attach(opts: AttachOptions): void {
    captureService.attach(opts);
    this.emit({ type: 'process-attached', payload: { processId: opts.processId, projectId: opts.projectId } });
  }

  detach(processId: string): void {
    captureService.detach(processId);
    this.emit({ type: 'process-detached', payload: { processId } });
  }

  injectSystem(projectId: number, text: string): void {
    captureService.injectSystem(projectId, text);
  }

  push(line: ConsoleLine): void {
    this.routeLine(line);
  }

  // ─── Health ──────────────────────────────────────────────────────────────

  getHealth(): ConsoleHealth {
    const captureSnap = captureService.getSnapshot();
    const streamSnap  = streamService.getSnapshot();

    const modules: ConsoleHealth['modules'] = {
      capture: {
        ok:      true,
        details: `${captureSnap.attached.length} process(es) attached, ${captureSnap.totalCaptured} lines captured`,
      },
      filter: {
        ok:      true,
        details: `${filterService.getRules().length} rules active`,
      },
      persist: { ok: true, details: 'batch writer running' },
      stream:  { ok: true, details: `${streamSnap.clientCount} SSE client(s)` },
      history: { ok: true, details: 'DB-backed history ready' },
    };

    const allOk = Object.values(modules).every((m) => m.ok);
    return {
      status:    allOk ? this.status : 'degraded',
      modules,
      uptime:    Math.floor((Date.now() - this.startedAt.getTime()) / 1000),
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

  // ─── Intelligence layer ──────────────────────────────────────────────────

  /**
   * Run all parsers on a log line and return structured meta.
   * Each parser is independent and returns null on no match.
   */
  private parseMeta(text: string): ConsoleLineMeta | undefined {
    const npm  = parseNpm(text);
    const vite = parseVite(text);
    const node = parseNode(text);

    const meta: ConsoleLineMeta = {};
    if (npm)  meta.npm  = npm;
    if (vite) meta.vite = vite;
    if (node) meta.node = node;

    return (npm || vite || node) ? meta : undefined;
  }

  // ─── Internal wiring ─────────────────────────────────────────────────────

  private wireCaptureToDownstream(): void {
    // Path A: captureService.attach() → onLine (for explicitly attached processes)
    captureService.onLine((line: ConsoleLine) => {
      this.routeLine(line);
    });

    // Process lifecycle → state machine + command lifecycle
    // processRegistry emits these as agent.event with phase="runtime"
    bus.on('agent.event', (e) => {
      if (e.phase !== 'runtime' || !e.projectId) return;
      const pid = e.projectId;
      const payload = e.payload as Record<string, unknown>;

      switch (e.eventType) {
        case 'process.started':
          runtimeStates.transition(pid, 'starting', 'Process starting…');
          commandLifecycle.start(pid, payload?.['command'] as string | undefined);
          break;
        case 'process.crashed':
          runtimeStates.force(pid, 'crashed', 'Process crashed');
          commandLifecycle.end(pid, 1);
          break;
        case 'process.stopped':
          runtimeStates.force(pid, 'idle');
          commandLifecycle.end(pid, 0);
          break;
        case 'process.restarted':
          runtimeStates.transition(pid, 'restarting', 'Restarting…');
          commandLifecycle.start(pid, payload?.['command'] as string | undefined);
          break;
      }
    });

    // console.state bus events → streamService.broadcastState() fan-out
    // runtimeStates emits these; we forward them to console SSE clients here
    // to avoid a circular dependency (runtime-states → streamService).
    (bus as any).on('console.state', (ev: {
      projectId: number; state: string; prev: string; message: string;
    }) => {
      streamService.broadcastState(ev.projectId, ev.state, ev.prev, ev.message);
    });

    // Path B: processRegistry emits bus.emit("console.log") directly (bypass).
    // This listener catches those events and routes through the full pipeline.
    // We skip re-emitting to bus here (routeLine does not re-emit) to avoid loops.
    bus.on('console.log', (e) => {
      const meta = this.parseMeta(e.line);

      // Update command lifecycle counter
      commandLifecycle.addLine(e.projectId);

      // Drive runtime state machine
      runtimeStates.inferFromMeta(e.projectId, e.line, meta);

      const line: ConsoleLine = {
        id:        `bus-${e.projectId}-${e.ts}`,
        projectId: e.projectId,
        kind:      e.stream === 'stderr' ? 'stderr' : 'stdout',
        text:      e.line,
        ts:        new Date(e.ts),
        meta,
      };

      // Persist (stderr/error goes immediately, rest is batched)
      if (line.kind === 'stderr') {
        persistService.persistNow(line).catch(() => {});
      } else {
        persistService.enqueue(line);
      }

      // Broadcast to console SSE clients (includes meta)
      streamService.broadcast(line);
      this.lineCount++;
    });
  }

  /**
   * Route a line that came via captureService (not bus bridge).
   * Runs intelligence layer + state machine, then persist + stream.
   */
  private routeLine(line: ConsoleLine): void {
    this.lineCount++;

    const meta = this.parseMeta(line.text);
    if (meta) line.meta = meta;

    commandLifecycle.addLine(line.projectId);
    runtimeStates.inferFromMeta(line.projectId, line.text, meta);

    if (line.kind === 'error') {
      persistService.persistNow(line).catch(() => {});
    } else {
      persistService.enqueue(line);
    }

    streamService.broadcast(line);

    this.emit({
      type:    'line-streamed',
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
