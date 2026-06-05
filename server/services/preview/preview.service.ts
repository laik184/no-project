/**
 * server/services/preview/preview.service.ts
 *
 * Preview URL management for the running sandbox application.
 * Resolves the live preview URL from Replit environment variables.
 *
 * Dependency rule:
 *   Tool → PreviewService (this) → process.env (infra)
 */

export interface PreviewInfo {
  url:       string;
  port:      number;
  available: boolean;
}

class PreviewService {
  private readonly port = 5000;

  getPreviewUrl(): string {
    const domain = process.env.REPLIT_DEV_DOMAIN;
    if (domain) return `https://${domain}`;
    return `http://localhost:${this.port}`;
  }

  async getInfo(): Promise<PreviewInfo> {
    const url       = this.getPreviewUrl();
    const available = await this.ping(url);
    return { url, port: this.port, available };
  }

  private async ping(url: string): Promise<boolean> {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(3000), method: 'HEAD' });
      return res.ok || res.status < 500;
    } catch {
      return false;
    }
  }
}

export const previewService = new PreviewService();
