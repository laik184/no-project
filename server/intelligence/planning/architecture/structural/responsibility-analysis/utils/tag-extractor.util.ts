import type { ConcernTag, ConcernEvidence } from "../types.js";

interface TagPattern {
  readonly tag:     ConcernTag;
  readonly pattern: RegExp;
}

const PATH_PATTERNS: readonly TagPattern[] = Object.freeze([
  { tag: "DATABASE",         pattern: /db|database|repo|repository|prisma|mongo|sql|orm|entity/i },
  { tag: "HTTP",             pattern: /route|router|controller|endpoint|http|rest|api|request|response/i },
  { tag: "FILESYSTEM",       pattern: /file|disk|fs|path|directory|folder|storage|upload|download/i },
  { tag: "AUTHENTICATION",   pattern: /auth|login|logout|token|session|jwt|oauth|password|credential/i },
  { tag: "CACHING",          pattern: /cache|redis|memo|memoiz/i },
  { tag: "SCHEDULING",       pattern: /scheduler|cron|job|queue|worker|task/i },
  { tag: "MESSAGING",        pattern: /event|emit|publish|subscribe|broker|message|kafka|rabbit/i },
  { tag: "VALIDATION",       pattern: /valid|schema|guard|rule|check|constraint/i },
  { tag: "LOGGING",          pattern: /log|logger|audit|trace|telemetry/i },
  { tag: "CONFIGURATION",    pattern: /config|env|setting|option|constant/i },
  { tag: "ORCHESTRATION",    pattern: /orchestrat|coordinat|workflow|pipeline|manager/i },
  { tag: "TESTING",          pattern: /test|spec|mock|fixture|stub|snapshot/i },
  { tag: "RENDERING",        pattern: /render|template|view|html|jsx|tsx|component/i },
  { tag: "STATE_MANAGEMENT", pattern: /state|store|reducer|slice|context/i },
  { tag: "TRANSFORMATION",   pattern: /transform|map|convert|adapt|serial|deserial|dto|mapper/i },
  { tag: "BUSINESS_LOGIC",   pattern: /service|domain|business|logic|core|use.?case|handler/i },
]);

const EXPORT_PATTERNS: readonly TagPattern[] = Object.freeze([
  { tag: "DATABASE",         pattern: /find|save|delete|insert|update|query|migrate|seed/i },
  { tag: "HTTP",             pattern: /get|post|put|patch|delete|handle|request|respond/i },
  { tag: "AUTHENTICATION",   pattern: /authenticate|authorize|signIn|signOut|verifyToken/i },
  { tag: "VALIDATION",       pattern: /validate|check|assert|guard|verify/i },
  { tag: "LOGGING",          pattern: /log|warn|error|info|debug|trace/i },
  { tag: "CACHING",          pattern: /cache|invalidate|evict|flush|hit/i },
  { tag: "TRANSFORMATION",   pattern: /transform|convert|serialize|deserialize|map|adapt/i },
  { tag: "SCHEDULING",       pattern: /schedule|enqueue|dispatch|run/i },
  { tag: "STATE_MANAGEMENT", pattern: /setState|getState|dispatch|commit|reset|clear/i },
]);

const CONTENT_PATTERNS: readonly TagPattern[] = Object.freeze([
  { tag: "DATABASE",         pattern: /SELECT|INSERT|UPDATE|DELETE|FROM|WHERE|JOIN|knex|prisma|mongoose/i },
  { tag: "HTTP",             pattern: /fetch\(|axios\.|http\.|https\.|express\(\)|router\./i },
  { tag: "FILESYSTEM",       pattern: /readFile|writeFile|unlink|mkdir|existsSync|createReadStream/i },
  { tag: "AUTHENTICATION",   pattern: /bcrypt|jwt\.sign|jwt\.verify|passport\.|session\./i },
  { tag: "CACHING",          pattern: /redis\.|memcache\.|\.set\(|\.get\(|\.del\(/i },
  { tag: "LOGGING",          pattern: /console\.(log|warn|error)|winston|pino|bunyan/i },
  { tag: "SCHEDULING",       pattern: /setInterval|setTimeout|cron\.|schedule\./i },
  { tag: "MESSAGING",        pattern: /EventEmitter|\.emit\(|\.on\(|\.subscribe\(|\.publish\(/i },
]);

function extractFromSource(
  text:     string,
  patterns: readonly TagPattern[],
  source:   ConcernEvidence["source"],
): ConcernEvidence[] {
  const found: ConcernEvidence[] = [];
  const seen   = new Set<ConcernTag>();
  for (const { tag, pattern } of patterns) {
    if (seen.has(tag)) continue;
    const match = text.match(pattern);
    if (match) {
      found.push(Object.freeze({ tag, matched: match[0], source }));
      seen.add(tag);
    }
  }
  return found;
}

export function extractConcernTags(
  path:        string,
  exports:     readonly string[],
  contentHint: string,
): readonly ConcernEvidence[] {
  const evidence: ConcernEvidence[] = [];

  evidence.push(...extractFromSource(path, PATH_PATTERNS, "path"));
  for (const exp of exports) {
    evidence.push(...extractFromSource(exp, EXPORT_PATTERNS, "export"));
  }
  if (contentHint.length > 0) {
    evidence.push(...extractFromSource(contentHint, CONTENT_PATTERNS, "content"));
  }

  const deduped = new Map<ConcernTag, ConcernEvidence>();
  for (const e of evidence) {
    if (!deduped.has(e.tag)) deduped.set(e.tag, e);
  }

  return Object.freeze([...deduped.values()]);
}

export function uniqueTags(evidence: readonly ConcernEvidence[]): readonly ConcernTag[] {
  return Object.freeze([...new Set(evidence.map((e) => e.tag))]);
}

export function tagsFromPath(path: string): readonly ConcernTag[] {
  const evidence = extractFromSource(path, PATH_PATTERNS, "path");
  return uniqueTags(evidence);
}
