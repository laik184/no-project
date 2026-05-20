import type { ChatFeatureContext, GeneratedModule } from '../types.js';
import { createSocketOptions } from '../utils/socket.util.js';
import { createId } from '../utils/id-generator.util.js';

export function generateSocketServerModule(context: ChatFeatureContext): GeneratedModule {
  const moduleId = createId('socket-server');
  const socketOptions = createSocketOptions(context.enableRedisAdapter);

  return Object.freeze({
    name: `socket-server.${moduleId}`,
    layer: 'L2',
    runtime: 'backend',
    code: `// generated at ${context.nowIso}
import { Server } from 'socket.io';

export function setupSocketServer(httpServer) {
  const io = new Server(httpServer, ${socketOptions});

  io.on('connection', (socket) => {
    socket.emit('chat:connected', { connectedAt: new Date().toISOString() });
  });

  return io;
}`,
  });
}
