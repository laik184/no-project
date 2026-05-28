/**
 * server/agents/coderx/reasoning/task-analyzer.ts
 *
 * Analyzes coding intent from a user prompt.
 * Produces a CodingTaskAnalysis — pure reasoning, no execution.
 */

import type { CodingRequest, CodingTaskAnalysis, CodingTaskKind } from '../types/coderx.types.ts';
import { normalizePrompt } from '../utils/coding-utils.ts';

// ── Complexity signals ─────────────────────────────────────────────────────────

const HIGH_COMPLEXITY_SIGNALS = [
  /full[\s-]?stack/i,
  /authentication system/i,
  /real[\s-]?time/i,
  /multi[\s-]?tenant/i,
  /microservice/i,
];

const LOW_COMPLEXITY_SIGNALS = [
  /simple|basic|small|quick|just/i,
  /single (component|function|file)/i,
  /one[\s-]?liner/i,
];

// ── Dependency signal patterns ────────────────────────────────────────────────

const DEPENDENCY_PATTERNS: Array<{ pattern: RegExp; dep: string }> = [
  { pattern: /drizzle|postgres|database/i, dep: 'database' },
  { pattern: /jwt|auth|session/i,          dep: 'auth' },
  { pattern: /react|vite|tsx/i,            dep: 'frontend' },
  { pattern: /express|route|endpoint/i,    dep: 'backend' },
  { pattern: /redis|queue|bullmq/i,        dep: 'queue' },
  { pattern: /websocket|ws|socket/i,       dep: 'websocket' },
];

// ── Constraint patterns ────────────────────────────────────────────────────────

const CONSTRAINT_PATTERNS: Array<{ pattern: RegExp; constraint: string }> = [
  { pattern: /typescript only/i,       constraint: 'typescript-only'    },
  { pattern: /no (any|unsafe)/i,       constraint: 'strict-types'       },
  { pattern: /no external/i,           constraint: 'no-external-deps'   },
  { pattern: /performance|fast|speed/i, constraint: 'performance'       },
  { pattern: /secure|security/i,       constraint: 'security'           },
];

// ── Kind inference ─────────────────────────────────────────────────────────────

const KIND_PATTERNS: Array<{ pattern: RegExp; kind: CodingTaskKind }> = [
  { pattern: /component|react|ui|view|page/i,   kind: 'generate_component'     },
  { pattern: /route|endpoint|express|handler/i, kind: 'generate_route'         },
  { pattern: /schema|model|drizzle|table/i,     kind: 'generate_schema'        },
  { pattern: /api client|fetch|axios/i,         kind: 'generate_api_client'    },
  { pattern: /auth|login|jwt|token/i,           kind: 'generate_auth'          },
  { pattern: /middleware/i,                     kind: 'generate_middleware'    },
  { pattern: /error handler|boundary/i,         kind: 'generate_error_handler' },
  { pattern: /controller|service/i,             kind: 'generate_controller'    },
  { pattern: /rest api|crud|resource/i,         kind: 'generate_rest_api'      },
  { pattern: /refactor|rename|restructure/i,    kind: 'refactor'               },
  { pattern: /analyze|review|audit/i,           kind: 'analyze'                },
  { pattern: /validate|lint|check/i,            kind: 'validate'               },
];

// ── Analyzer ──────────────────────────────────────────────────────────────────

export function analyzeCodingTask(request: CodingRequest): CodingTaskAnalysis {
  const prompt = normalizePrompt(request.userPrompt);

  return {
    intent:       extractIntent(prompt),
    primaryKind:  inferPrimaryKind(prompt),
    complexity:   assessComplexity(prompt),
    dependencies: extractDependencies(prompt),
    constraints:  extractConstraints(prompt),
  };
}

function extractIntent(prompt: string): string {
  const first = prompt.split(/[.!?]/)[0] ?? prompt;
  return first.trim().slice(0, 120);
}

function inferPrimaryKind(prompt: string): CodingTaskKind {
  for (const { pattern, kind } of KIND_PATTERNS) {
    if (pattern.test(prompt)) return kind;
  }
  return 'generate_component';
}

function assessComplexity(prompt: string): 'low' | 'medium' | 'high' {
  if (HIGH_COMPLEXITY_SIGNALS.some((p) => p.test(prompt))) return 'high';
  if (LOW_COMPLEXITY_SIGNALS.some((p) => p.test(prompt)))  return 'low';
  return 'medium';
}

function extractDependencies(prompt: string): string[] {
  return DEPENDENCY_PATTERNS
    .filter(({ pattern }) => pattern.test(prompt))
    .map(({ dep }) => dep);
}

function extractConstraints(prompt: string): string[] {
  return CONSTRAINT_PATTERNS
    .filter(({ pattern }) => pattern.test(prompt))
    .map(({ constraint }) => constraint);
}
