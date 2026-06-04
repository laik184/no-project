/**
 * server/agents/browser/utils/navigation-utils.ts
 *
 * URL validation, normalisation, and allow-list helpers.
 * Pure string utilities — no network or Playwright access.
 */

const BLANK_PAGES = new Set([
  'about:blank',
  'chrome://newtab/',
  'about:newtab',
  '',
]);

// ── URL validation ────────────────────────────────────────────────────────────

/**
 * Returns true if `url` is on one of the `allowedHosts`.
 * If `allowedHosts` is empty, any HTTPS URL is permitted.
 */
export function isAllowedUrl(url: string, allowedHosts: string[] = []): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false;
  if (allowedHosts.length === 0) return true;

  return allowedHosts.some(host => {
    const normalHost = host.toLowerCase().replace(/^https?:\/\//, '');
    return (
      parsed.hostname === normalHost ||
      parsed.hostname.endsWith(`.${normalHost}`)
    );
  });
}

/**
 * Returns true if the URL is a blank/new-tab page.
 */
export function isBlankPage(url: string): boolean {
  return BLANK_PAGES.has(url.trim().toLowerCase());
}

// ── URL normalisation ─────────────────────────────────────────────────────────

/**
 * Ensures the URL has an explicit protocol; defaults to https://.
 */
export function normalizeUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.startsWith('//'))       return `https:${trimmed}`;
  return `https://${trimmed}`;
}

/**
 * Strips hash and search params, returning the bare path URL.
 */
export function stripQueryAndHash(url: string): string {
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.host}${u.pathname}`;
  } catch {
    return url;
  }
}

/**
 * Extracts the hostname from a URL; returns '' on parse failure.
 */
export function extractHostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
}

/**
 * Returns true if two URLs point to the same origin (protocol + host + port).
 */
export function isSameOrigin(a: string, b: string): boolean {
  try {
    return new URL(a).origin === new URL(b).origin;
  } catch {
    return false;
  }
}
