export class PreviewBehaviorVerifier {
  constructor(private previewUrl?: string) {}

  async verify(): Promise<{ ok: boolean; responsive: boolean; error?: string }> {
    if (!this.previewUrl) return { ok: true, responsive: false };
    try {
      const res = await fetch(this.previewUrl, { signal: AbortSignal.timeout(8_000) });
      return { ok: res.ok, responsive: true };
    } catch (err) {
      return { ok: false, responsive: false, error: String(err) };
    }
  }
}
