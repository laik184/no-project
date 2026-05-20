import type { ChatFeatureContext, GeneratedModule } from '../types.js';
import { createId } from '../utils/id-generator.util.js';

export function generatePresenceManagerModule(context: ChatFeatureContext): GeneratedModule {
  const moduleId = createId('presence-manager');

  return Object.freeze({
    name: `presence-manager.${moduleId}`,
    layer: 'L2',
    runtime: 'backend',
    code: `// generated at ${context.nowIso}
export function markOnline(io, userId) {
  io.emit('chat:presence.updated', {
    userId,
    status: 'ONLINE',
    lastUpdatedAt: new Date().toISOString()
  });
}

export function markOffline(io, userId) {
  io.emit('chat:presence.updated', {
    userId,
    status: 'OFFLINE',
    lastUpdatedAt: new Date().toISOString()
  });
}`,
  });
}
