import type { ApiEndpoint, HttpMethod } from "../types.js";
import { SCHEMA_VALIDATION_PATTERNS, VERSION_PATH_PATTERN } from "../types.js";
import { extractRoutes, extractVersionFromRoute, hasPattern } from "./pattern.matcher.util.js";

let _endpointCounter = 0;
export function resetEndpointCounter(): void { _endpointCounter = 0; }

function nextEndpointId(): string {
  _endpointCounter += 1;
  return `ep-${String(_endpointCounter).padStart(4, "0")}`;
}

const VALID_METHODS = new Set<string>(["GET", "POST", "PUT", "PATCH", "DELETE", "ALL", "OPTIONS", "HEAD"]);

function isValidMethod(m: string): m is HttpMethod {
  return VALID_METHODS.has(m.toUpperCase());
}

function fileHasSchemaValidation(content: string): boolean {
  return SCHEMA_VALIDATION_PATTERNS.some((rx) => hasPattern(content, rx));
}

function fileHasAuthMiddleware(content: string): boolean {
  return /authenticate|requireAuth|verifyToken|authMiddleware|bearerAuth|jwtMiddleware|isAuthenticated/i.test(content);
}

export function parseEndpointsFromFile(
  filePath: string,
  content:  string,
): readonly ApiEndpoint[] {
  const routes     = extractRoutes(content);
  const hasSchema  = fileHasSchemaValidation(content);
  const hasAuth    = fileHasAuthMiddleware(content);
  const endpoints: ApiEndpoint[] = [];

  for (const route of routes) {
    if (!isValidMethod(route.method)) continue;

    const version = extractVersionFromRoute(route.route);

    endpoints.push(Object.freeze({
      id:         nextEndpointId(),
      filePath,
      method:     route.method as HttpMethod,
      route:      route.route,
      version,
      line:       route.line,
      hasAuth,
      hasSchema,
      rawSnippet: route.snippet,
    }));
  }

  return Object.freeze(endpoints);
}

export function groupEndpointsByVersion(
  endpoints: readonly ApiEndpoint[],
): ReadonlyMap<string, readonly ApiEndpoint[]> {
  const map = new Map<string, ApiEndpoint[]>();
  for (const ep of endpoints) {
    const key = ep.version ?? "unversioned";
    const list = map.get(key) ?? [];
    list.push(ep);
    map.set(key, list);
  }
  return map;
}

export function groupEndpointsByResource(
  endpoints: readonly ApiEndpoint[],
): ReadonlyMap<string, readonly ApiEndpoint[]> {
  const map = new Map<string, ApiEndpoint[]>();
  for (const ep of endpoints) {
    const resource = extractResourceName(ep.route);
    const list = map.get(resource) ?? [];
    list.push(ep);
    map.set(resource, list);
  }
  return map;
}

export function extractResourceName(route: string): string {
  const segments = route
    .replace(/\/v\d+/, "")
    .split("/")
    .filter((s) => s && !s.startsWith(":") && !s.startsWith("{"));
  return segments[0] ?? "root";
}

export function extractPathParams(route: string): readonly string[] {
  const params: string[] = [];
  const matches = route.matchAll(/:([a-zA-Z_]\w*)|{([a-zA-Z_]\w*)}/g);
  for (const m of matches) {
    params.push(m[1] ?? m[2] ?? "");
  }
  return Object.freeze(params);
}

export function detectVersioningStrategy(
  endpoints: readonly ApiEndpoint[],
): import("../types.js").VersioningStrategy {
  const pathVersioned   = endpoints.filter((e) => e.version !== null).length;
  const totalEndpoints  = endpoints.length;

  if (totalEndpoints === 0) return "NONE";

  const hasHeaderVersioning = false;
  const hasQueryVersioning  = false;

  const pathRatio = pathVersioned / totalEndpoints;

  if (pathRatio >= 0.9) return "PATH";
  if (pathRatio > 0 && pathRatio < 0.9) return "MIXED";
  if (hasHeaderVersioning) return "HEADER";
  if (hasQueryVersioning)  return "QUERY_PARAM";
  return "NONE";
}

export function routeSignature(endpoint: ApiEndpoint): string {
  const normalized = endpoint.route
    .replace(/:([a-zA-Z_]\w*)/g, "{param}")
    .replace(/\{[^}]+\}/g, "{param}")
    .replace(/\/+$/, "");
  return `${endpoint.method}:${normalized}`;
}
