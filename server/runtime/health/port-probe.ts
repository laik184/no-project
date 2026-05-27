import { createConnection } from 'net';

export function probePort(port: number, host = '127.0.0.1', timeoutMs = 2_000): Promise<boolean> {
  return new Promise((resolve) => {
    const sock = createConnection({ port, host });
    const timer = setTimeout(() => { sock.destroy(); resolve(false); }, timeoutMs);
    sock.once('connect', () => { clearTimeout(timer); sock.destroy(); resolve(true); });
    sock.once('error',   () => { clearTimeout(timer); resolve(false); });
  });
}

export async function waitForPort(
  port: number,
  opts: { host?: string; timeoutMs?: number; intervalMs?: number } = {},
): Promise<boolean> {
  const { host = '127.0.0.1', timeoutMs = 30_000, intervalMs = 500 } = opts;
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await probePort(port, host, Math.min(intervalMs, deadline - Date.now()))) return true;
    await new Promise(r => setTimeout(r, intervalMs));
  }
  return false;
}
