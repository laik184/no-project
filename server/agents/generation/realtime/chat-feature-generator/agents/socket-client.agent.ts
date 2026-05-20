import type { ChatFeatureContext, GeneratedModule } from '../types.js';
import { createReconnectSnippet } from '../utils/socket.util.js';
import { createId } from '../utils/id-generator.util.js';

export function generateSocketClientModule(context: ChatFeatureContext): GeneratedModule {
  const moduleId = createId('socket-client');

  return Object.freeze({
    name: `socket-client.${moduleId}`,
    layer: 'L2',
    runtime: 'frontend',
    code: `// generated at ${context.nowIso}
import { io } from 'socket.io-client';

export function connectClient(url) {
  const socket = io(url, {
    ${createReconnectSnippet()}
  });

  socket.on('chat:connected', (data) => {
    console.log('chat connected', data);
  });

  return socket;
}`,
  });
}
