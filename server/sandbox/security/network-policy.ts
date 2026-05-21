/**
 * server/sandbox/security/network-policy.ts
 * Validates outbound network requests against allowed host whitelist.
 * Single responsibility: network scope enforcement. No execution.
 */

export interface NetworkCheckResult {
  allowed:  boolean;
  host:     string;
  reason:   string;
}

// Default production-safe outbound allowlist
const DEFAULT_ALLOWED_HOSTS: Set<string> = new Set([
  "registry.npmjs.org",
  "registry.yarnpkg.com",
  "openrouter.ai",
  "api.openai.com",
  "api.anthropic.com",
  "raw.githubusercontent.com",
  "github.com",
  "cdn.jsdelivr.net",
  "unpkg.com",
]);

// Always blocked — regardless of config
const ALWAYS_BLOCKED: RegExp[] = [
  /^169\.254\./,         // AWS metadata service
  /^10\.\d+\.\d+\.\d+/, // private class A
  /^192\.168\./,         // private class C
  /^172\.(1[6-9]|2\d|3[01])\./,  // private class B
  /^localhost$/i,
  /^127\./,
  /^0\.0\.0\.0/,
];

function extractHost(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url.split("/")[0].split(":")[0];
  }
}

function isPrivateIp(host: string): boolean {
  return ALWAYS_BLOCKED.some(p => p.test(host));
}

export function checkNetworkAccess(
  url: string,
  allowedHosts: string[] = [],
): NetworkCheckResult {
  const host    = extractHost(url);
  const allowed = new Set([...DEFAULT_ALLOWED_HOSTS, ...allowedHosts]);

  if (isPrivateIp(host)) {
    return {
      allowed: false,
      host,
      reason: `Access to private/internal IP "${host}" is forbidden in sandbox.`,
    };
  }

  if (allowed.has(host)) {
    return { allowed: true, host, reason: `Host "${host}" is on the allowlist.` };
  }

  return {
    allowed: false,
    host,
    reason: `Host "${host}" is not on the outbound allowlist. Add it to proceed.`,
  };
}

export function batchCheckNetwork(
  urls: string[],
  allowedHosts?: string[],
): NetworkCheckResult[] {
  return urls.map(u => checkNetworkAccess(u, allowedHosts));
}
