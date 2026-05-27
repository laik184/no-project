import net from 'net';

export async function isPortInUse(port: number, host = '127.0.0.1'): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => resolve(true));
    server.once('listening', () => { server.close(); resolve(false); });
    server.listen(port, host);
  });
}

export async function scanPortRange(
  start: number,
  end:   number,
): Promise<number[]> {
  const inUse: number[] = [];
  const checks = Array.from({ length: end - start + 1 }, (_, i) => start + i);
  await Promise.all(
    checks.map(async (port) => {
      if (await isPortInUse(port)) inUse.push(port);
    }),
  );
  return inUse.sort((a, b) => a - b);
}

export async function findFreePort(
  start = 4000,
  end   = 9999,
): Promise<number> {
  for (let port = start; port <= end; port++) {
    if (!(await isPortInUse(port))) return port;
  }
  throw new Error(`[port-scanner] No free port found in range ${start}-${end}`);
}
