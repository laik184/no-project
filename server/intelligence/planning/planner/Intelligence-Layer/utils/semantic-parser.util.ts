import type { IntentType, ActionPhrase } from "../types.js";

const ACTION_VERB_MAP: ReadonlyArray<readonly [IntentType, readonly string[]]> =
  Object.freeze([
    ["CREATE",    Object.freeze(["create", "build", "generate", "implement", "write", "develop", "make", "add", "scaffold", "init", "setup"])],
    ["MODIFY",    Object.freeze(["modify", "update", "refactor", "edit", "change", "improve", "enhance", "extend", "upgrade", "patch"])],
    ["DELETE",    Object.freeze(["delete", "remove", "drop", "destroy", "clean", "purge", "uninstall"])],
    ["ANALYZE",   Object.freeze(["analyze", "audit", "inspect", "review", "assess", "evaluate", "examine", "check", "profile"])],
    ["DEPLOY",    Object.freeze(["deploy", "publish", "release", "ship", "push", "launch", "host", "serve"])],
    ["TEST",      Object.freeze(["test", "spec", "verify", "assert", "validate", "mock", "stub", "cover"])],
    ["DOCUMENT",  Object.freeze(["document", "doc", "readme", "comment", "describe", "annotate", "guide"])],
    ["CONFIGURE", Object.freeze(["configure", "config", "setup", "set", "define", "specify", "initialize", "bootstrap"])],
    ["MIGRATE",   Object.freeze(["migrate", "move", "transfer", "port", "convert", "upgrade", "transition"])],
    ["OPTIMIZE",  Object.freeze(["optimize", "speed", "performance", "cache", "reduce", "minimize", "improve"])],
    ["REVIEW",    Object.freeze(["review", "approve", "sign-off", "confirm", "finalize", "complete"])],
  ]);

const DOMAIN_KEYWORD_MAP: ReadonlyArray<readonly [string, readonly string[]]> = Object.freeze([
  ["backend",    Object.freeze(["api", "server", "express", "fastify", "route", "controller", "service", "repository", "endpoint", "rest", "graphql"])],
  ["frontend",   Object.freeze(["ui", "component", "react", "vue", "angular", "css", "style", "interface", "page", "layout"])],
  ["database",   Object.freeze(["database", "db", "sql", "postgres", "mysql", "mongo", "schema", "table", "migration", "orm", "entity"])],
  ["testing",    Object.freeze(["test", "spec", "unit", "integration", "e2e", "jest", "mocha", "coverage"])],
  ["devops",     Object.freeze(["deploy", "ci", "cd", "pipeline", "docker", "kubernetes", "cloud", "aws", "github-actions"])],
  ["fullstack",  Object.freeze(["fullstack", "full-stack", "monorepo", "workspace", "project"])],
]);

const SCOPE_KEYWORDS: ReadonlyArray<readonly [string, readonly string[]]> = Object.freeze([
  ["single-entity",    Object.freeze(["entity", "model", "one", "single", "a"])],
  ["multi-entity",     Object.freeze(["entities", "models", "multiple", "all", "many", "full"])],
  ["full-application", Object.freeze(["application", "app", "project", "system", "platform", "entire"])],
  ["module",           Object.freeze(["module", "package", "library", "plugin", "extension"])],
]);

export function detectIntentType(text: string): IntentType {
  const lower = text.toLowerCase();
  for (const [intent, verbs] of ACTION_VERB_MAP) {
    if (verbs.some(v => lower.includes(v))) return intent;
  }
  return "CREATE";
}

export function detectAllIntents(text: string): readonly IntentType[] {
  const lower   = text.toLowerCase();
  const matched = new Set<IntentType>();
  for (const [intent, verbs] of ACTION_VERB_MAP) {
    if (verbs.some(v => lower.includes(v))) matched.add(intent);
  }
  if (matched.size === 0) matched.add("CREATE");
  return Object.freeze([...matched]);
}

export function extractActionPhrases(text: string): readonly ActionPhrase[] {
  const phrases: ActionPhrase[] = [];
  const sentences = text.split(/[.!?;,]+/).map(s => s.trim()).filter(s => s.length > 3);

  for (const sentence of sentences) {
    const lower = sentence.toLowerCase();
    for (const [, verbs] of ACTION_VERB_MAP) {
      const matchedVerb = verbs.find(v => lower.startsWith(v) || lower.includes(` ${v} `));
      if (matchedVerb === undefined) continue;

      const verbIndex = lower.indexOf(matchedVerb);
      const remainder = sentence.slice(verbIndex + matchedVerb.length).trim();
      const words     = remainder.split(/\s+/);
      const obj       = words.slice(0, 3).join(" ");
      const qualifier = words.slice(3, 6).join(" ");

      if (obj.length > 0) {
        phrases.push(Object.freeze<ActionPhrase>({
          verb:      matchedVerb,
          object:    obj,
          qualifier: qualifier,
        }));
        break;
      }
    }
  }

  return Object.freeze(phrases.slice(0, 10));
}

export function detectDomain(keywords: readonly string[]): string {
  const joined = keywords.join(" ").toLowerCase();
  const scores: Array<{ domain: string; score: number }> = [];

  for (const [domain, domainWords] of DOMAIN_KEYWORD_MAP) {
    const matches = domainWords.filter(w => joined.includes(w));
    if (matches.length > 0) scores.push({ domain, score: matches.length });
  }

  if (scores.length === 0) return "general";
  scores.sort((a, b) => b.score - a.score);
  return scores[0]!.domain;
}

export function detectScope(keywords: readonly string[]): string {
  const joined = keywords.join(" ").toLowerCase();
  for (const [scope, scopeWords] of SCOPE_KEYWORDS) {
    if (scopeWords.some(w => joined.includes(w))) return scope;
  }
  return "single-entity";
}
