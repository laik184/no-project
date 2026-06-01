/**
 * server/file-explorer/realtime/file-subscriber.ts
 * Subscribes to bus 'agent.event' and re-publishes file.change events to TOPIC.FILE.
 * This ensures agent-written files also trigger SSE updates in the file explorer.
 */

import { bus }         from '../../infrastructure/index.ts';
import { publishCreated, publishModified, publishDeleted } from './file-publisher.ts';

let subscribed = false;

/** Call once at startup to bridge agent file events → TOPIC.FILE fan-out. */
export function subscribeToAgentFileEvents(): void {
  if (subscribed) return;
  subscribed = true;

  bus.on('agent.event', (payload) => {
    const p = payload as Record<string, unknown>;
    if (p['type'] !== 'file.change') return;

    const path      = typeof p['path']      === 'string' ? p['path']      : '';
    const kind      = typeof p['kind']      === 'string' ? p['kind']      : '';
    const projectId = typeof p['projectId'] === 'number' ? p['projectId'] : 0;

    if (!path) return;

    if (kind === 'created')  publishCreated(path, projectId);
    else if (kind === 'modified') publishModified(path, projectId);
    else if (kind === 'deleted')  publishDeleted(path, projectId);
  });
}
