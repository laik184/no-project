export function createSocketOptions(enableRedisAdapter: boolean): string {
  if (enableRedisAdapter) {
    return `{
  cors: { origin: '*', methods: ['GET', 'POST'] },
  transports: ['websocket', 'polling'],
  adapter: createRedisAdapter(pubClient, subClient)
}`;
  }

  return `{
  cors: { origin: '*', methods: ['GET', 'POST'] },
  transports: ['websocket', 'polling']
}`;
}

export function createReconnectSnippet(): string {
  return `reconnection: true, reconnectionAttempts: 10, reconnectionDelay: 500`;
}
