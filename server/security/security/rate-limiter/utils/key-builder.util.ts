import { sha256Short } from "./hash.util.js";

export function buildIpKey(ip: string, route?: string): string {
  const base = `ip:${ip}`;
  return route ? `${base}:${route}` : base;
}

export function buildUserKey(userId: string, route?: string): string {
  const base = `user:${userId}`;
  return route ? `${base}:${route}` : base;
}

export function buildApiKeyKey(apiKey: string, route?: string): string {
  const hashed = sha256Short(apiKey);
  const base = `apikey:${hashed}`;
  return route ? `${base}:${route}` : base;
}

export function buildLimitConfigKey(target: string, route?: string): string {
  return route ? `config:${target}:${route}` : `config:${target}`;
}
