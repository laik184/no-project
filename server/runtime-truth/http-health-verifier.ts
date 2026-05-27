export class HTTPHealthVerifier {
  constructor(private port: number, private host = '127.0.0.1') {}

  async verify(): Promise<{ ok: boolean; statusCode?: number; error?: string }> {
    try {
      const res = await fetch(`http://${this.host}:${this.port}/health`, {
        signal: AbortSignal.timeout(5_000),
      });
      return { ok: res.ok, statusCode: res.status };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  }
}
