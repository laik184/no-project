/**
 * coordination/verification-routing.ts
 * Routes verification phases to their canonical workflow and tool sequences.
 */

import type { VerificationPhase } from '../types/verifier.types.ts';
import type { WorkflowKind } from '../types/workflow.types.ts';
import { VERIFIER_TOOLS } from './tool-coordinator.ts';

export type ToolName = typeof VERIFIER_TOOLS[keyof typeof VERIFIER_TOOLS];

export interface PhaseRoute {
  phase:        VerificationPhase;
  workflow:     WorkflowKind;
  tools:        ToolName[];
  required:     boolean;
  parallelable: boolean;
}

export const PHASE_ROUTES: Record<VerificationPhase, PhaseRoute> = {
  dependencies: {
    phase:        'dependencies',
    workflow:     'validation',
    tools:        [VERIFIER_TOOLS.DEP_VALIDATE],
    required:     true,
    parallelable: false,
  },
  typecheck: {
    phase:        'typecheck',
    workflow:     'build',
    tools:        [VERIFIER_TOOLS.RUN_TYPECHECK, VERIFIER_TOOLS.PARSE_TYPECHECK, VERIFIER_TOOLS.CLASSIFY_TS_ERRORS],
    required:     true,
    parallelable: false,
  },
  build: {
    phase:        'build',
    workflow:     'build',
    tools:        [VERIFIER_TOOLS.BUILD, VERIFIER_TOOLS.PARSE_BUILD, VERIFIER_TOOLS.BUILD_ERRORS],
    required:     true,
    parallelable: false,
  },
  runtime: {
    phase:        'runtime',
    workflow:     'runtime',
    tools:        [VERIFIER_TOOLS.SERVER_HEALTH, VERIFIER_TOOLS.RUNTIME_VALIDATE, VERIFIER_TOOLS.CRASH_DETECT],
    required:     true,
    parallelable: false,
  },
  endpoints: {
    phase:        'endpoints',
    workflow:     'runtime',
    tools:        [VERIFIER_TOOLS.ENDPOINT_VALIDATE],
    required:     false,
    parallelable: true,
  },
  tests: {
    phase:        'tests',
    workflow:     'validation',
    tools:        [VERIFIER_TOOLS.RUN_TESTS, VERIFIER_TOOLS.PARSE_TESTS, VERIFIER_TOOLS.CLASSIFY_FAILURES],
    required:     false,
    parallelable: false,
  },
  validation: {
    phase:        'validation',
    workflow:     'validation',
    tools:        [VERIFIER_TOOLS.OUTPUT_VALIDATE, VERIFIER_TOOLS.VERIFY_VALIDATE],
    required:     false,
    parallelable: true,
  },
};

export function routePhase(phase: VerificationPhase): PhaseRoute {
  return PHASE_ROUTES[phase];
}

export function workflowForPhase(phase: VerificationPhase): WorkflowKind {
  return PHASE_ROUTES[phase].workflow;
}

export function toolsForPhase(phase: VerificationPhase): ToolName[] {
  return PHASE_ROUTES[phase].tools;
}

export function isRequiredPhase(phase: VerificationPhase): boolean {
  return PHASE_ROUTES[phase].required;
}
