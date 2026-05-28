/**
 * server/agents/coderx/planning/code-planner.ts
 *
 * Converts a user's natural-language coding request into a structured CodingPlan.
 * Pure planning logic — no execution, no dispatcher calls.
 */

import type {
  CodingRequest,
  CodingPlan,
  CodingTask,
  CodingTaskKind,
} from '../types/coderx.types.ts';
import { generatePlanId, generateTaskId, now } from '../utils/coding-utils.ts';

// ── Keyword → task kind heuristics ────────────────────────────────────────────

const KIND_PATTERNS: Array<{ pattern: RegExp; kind: CodingTaskKind }> = [
  { pattern: /component|react|ui|view|page/i,      kind: 'generate_component'     },
  { pattern: /route|endpoint|express|handler/i,    kind: 'generate_route'         },
  { pattern: /schema|model|drizzle|table/i,        kind: 'generate_schema'        },
  { pattern: /api client|fetch|axios|http/i,       kind: 'generate_api_client'    },
  { pattern: /auth|login|jwt|token/i,              kind: 'generate_auth'          },
  { pattern: /middleware|intercept/i,              kind: 'generate_middleware'    },
  { pattern: /error handler|catch|boundary/i,      kind: 'generate_error_handler' },
  { pattern: /controller|service layer/i,          kind: 'generate_controller'    },
  { pattern: /rest api|crud|resource/i,            kind: 'generate_rest_api'      },
  { pattern: /refactor|rename|restructure/i,       kind: 'refactor'               },
  { pattern: /analyze|review|audit/i,              kind: 'analyze'                },
  { pattern: /validate|lint|check/i,               kind: 'validate'               },
];

function inferKind(prompt: string): CodingTaskKind {
  for (const { pattern, kind } of KIND_PATTERNS) {
    if (pattern.test(prompt)) return kind;
  }
  return 'generate_component';
}

// ── Plan builder ──────────────────────────────────────────────────────────────

export function buildCodingPlan(request: CodingRequest): CodingPlan {
  const primaryKind = inferKind(request.userPrompt);

  const tasks: CodingTask[] = [
    buildAnalyzeTask(request),
    buildPrimaryTask(request, primaryKind),
    buildValidateTask(request, primaryKind),
  ];

  return {
    planId:    generatePlanId(),
    requestId: request.requestId,
    tasks,
    createdAt: now(),
  };
}

// ── Task factories ────────────────────────────────────────────────────────────

function buildAnalyzeTask(request: CodingRequest): CodingTask {
  return {
    taskId:      generateTaskId(),
    kind:        'analyze',
    description: `Analyze coding intent for: "${request.userPrompt.slice(0, 80)}"`,
    input: {
      prompt:    request.userPrompt,
      projectId: request.projectId,
      context:   request.context ?? {},
    },
  };
}

function buildPrimaryTask(request: CodingRequest, kind: CodingTaskKind): CodingTask {
  return {
    taskId:      generateTaskId(),
    kind,
    description: `Execute ${kind} for: "${request.userPrompt.slice(0, 80)}"`,
    input: {
      prompt:      request.userPrompt,
      projectId:   request.projectId,
      sandboxRoot: request.sandboxRoot,
      context:     request.context ?? {},
    },
  };
}

function buildValidateTask(request: CodingRequest, primaryKind: CodingTaskKind): CodingTask {
  return {
    taskId:      generateTaskId(),
    kind:        'validate',
    description: `Validate output of ${primaryKind}`,
    input: {
      projectId:   request.projectId,
      sandboxRoot: request.sandboxRoot,
    },
  };
}
