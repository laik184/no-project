import type { CodeFile } from "../types.js";

export interface RouteMatch {
  readonly method:   string;
  readonly route:    string;
  readonly line:     number | null;
  readonly snippet:  string | null;
}

export interface GenericMatch {
  readonly matched: string;
  readonly line:    number | null;
  readonly snippet: string | null;
}

export function matchPattern(
  content: string,
  pattern: RegExp,
): readonly GenericMatch[] {
  const results: GenericMatch[] = [];
  const lines   = content.split("\n");
  const flags   = pattern.flags.includes("g") ? pattern.flags : pattern.flags + "g";
  const safeRx  = new RegExp(pattern.source, flags);

  let match: RegExpExecArray | null;
  while ((match = safeRx.exec(content)) !== null) {
    const before  = content.slice(0, match.index);
    const line    = before.split("\n").length;
    const snippet = (lines[line - 1] ?? "").trim().slice(0, 120) || null;
    results.push(Object.freeze({ matched: match[0].slice(0, 120), line, snippet }));
    if (results.length >= 50) break;
  }

  return Object.freeze(results);
}

export function extractRoutes(content: string): readonly RouteMatch[] {
  const routes: RouteMatch[] = [];
  const lines = content.split("\n");

  const patterns: Array<{ rx: RegExp; methodGroup: number; routeGroup: number }> = [
    { rx: /(?:router|app)\.(get|post|put|patch|delete|all|options)\s*\(\s*['"`]([^'"`,]+)['"`]/g, methodGroup: 1, routeGroup: 2 },
    { rx: /fastify\.(get|post|put|patch|delete)\s*\(\s*['"`]([^'"`,]+)['"`]/g,                    methodGroup: 1, routeGroup: 2 },
    { rx: /@(Get|Post|Put|Patch|Delete)\s*\(\s*['"`]([^'"`,]*)['"`]/g,                            methodGroup: 1, routeGroup: 2 },
  ];

  for (const { rx, methodGroup, routeGroup } of patterns) {
    const safeRx = new RegExp(rx.source, "g");
    let match: RegExpExecArray | null;
    while ((match = safeRx.exec(content)) !== null) {
      const before  = content.slice(0, match.index);
      const line    = before.split("\n").length;
      const snippet = (lines[line - 1] ?? "").trim().slice(0, 120) || null;
      routes.push(Object.freeze({
        method:  (match[methodGroup] ?? "GET").toUpperCase(),
        route:   match[routeGroup] ?? "",
        line,
        snippet,
      }));
    }
  }

  return Object.freeze(routes);
}

export function extractVersionFromRoute(route: string): string | null {
  const match = route.match(/\/v(\d+)\//);
  return match ? `v${match[1]}` : null;
}

export function isRouteFile(filePath: string): boolean {
  return (
    filePath.includes("/routes/") ||
    filePath.includes("/router/") ||
    filePath.endsWith(".route.ts") ||
    filePath.endsWith(".route.js") ||
    filePath.endsWith(".router.ts") ||
    filePath.includes("/controllers/") ||
    filePath.includes("/handlers/") ||
    filePath.endsWith(".controller.ts") ||
    filePath.endsWith(".controller.js")
  );
}

export function isTestFile(filePath: string): boolean {
  return (
    filePath.includes(".test.") ||
    filePath.includes(".spec.") ||
    filePath.includes("__tests__") ||
    filePath.includes("/__mocks__/")
  );
}

export function isTypeFile(filePath: string): boolean {
  return filePath.endsWith(".d.ts") || filePath.endsWith("types.ts") || filePath.endsWith("types.js");
}

export function hasPattern(content: string, pattern: RegExp): boolean {
  const flags  = pattern.flags.replace("g", "") + "g";
  const safeRx = new RegExp(pattern.source, flags);
  return safeRx.test(content);
}

export function countPattern(content: string, pattern: RegExp): number {
  const flags  = pattern.flags.includes("g") ? pattern.flags : pattern.flags + "g";
  const safeRx = new RegExp(pattern.source, flags);
  return (content.match(safeRx) ?? []).length;
}
