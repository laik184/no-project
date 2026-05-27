/**
 * server/runtime-events/index.ts
 *
 * Runtime event wiring — connects runtime lifecycle events to the
 * telemetry bus and execution-graph live tracking.
 */

import { bus } from '../infrastructure/events/bus.ts';

let initialized = false;

export function initRuntimeEvents(): void {
  if (initialized) return;
  initialized = true;

  bus.on('process.started', (payload: unknown) => {
    bus.emit('telemetry.runtime.started', payload);
  });

  bus.on('process.stopped', (payload: unknown) => {
    bus.emit('telemetry.runtime.stopped', payload);
  });

  bus.on('process.crashed', (payload: unknown) => {
    bus.emit('telemetry.runtime.crashed', payload);
    bus.emit('process.crashed', payload);
  });

  bus.on('process.restarted', (payload: unknown) => {
    bus.emit('telemetry.runtime.restarted', payload);
  });

  console.log('[runtime-events] Runtime event wiring initialized');
}
