import { registerFilesystemEventHandlers } from './events/event-handlers.ts';
import { filesystemEngine }               from './core/filesystem-engine.ts';

export function initializeFilesystemAgent(): void {
  registerFilesystemEventHandlers();
  console.log('[filesystem-agent] Initialized — event handlers registered');
}

export { filesystemEngine };
