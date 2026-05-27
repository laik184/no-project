/**
 * navigation-utils.ts
 * URL validation and safe-navigation helpers.
 */

const ALLOWED_PROTOCOLS  = new Set(['http:', 'https:']);
const LOOPBACK_HOSTS     = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::1']);

export function isAllowedUrl(rawUrl: string, allowedHosts: string[] = []): boolean {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return false;
  }

  if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) return false;

  const host = parsed.hostname;
  if (LOOPBACK_HOSTS.has(host))               return true;
  if (allowedHosts.includes(host))            return true;

  // Allow Replit dev-domain previews
  if (host.endsWith('.replit.dev') || host.endsWith('.repl.co')) return true;

  return false;
}

export function normalizeUrl(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
  return `http://${trimmed}`;
}

export function buildLocalUrl(port: number, path = '/'): string {
  const p = path.startsWith('/') ? path : `/${path}`;
  return `http://localhost:${port}${p}`;
}

export function extractHost(rawUrl: string): string | null {
  try {
    return new URL(rawUrl).hostname;
  } catch {
    return null;
  }
}

export function isBlankPage(title: string, bodyText: string): boolean {
  const emptyTitle = !title || title.trim() === '' || title === 'about:blank';
  const emptyBody  = bodyText.trim().length < 10;
  return emptyTitle && emptyBody;
}
