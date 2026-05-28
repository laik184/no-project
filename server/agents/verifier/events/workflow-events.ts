/**
 * events/workflow-events.ts
 * Workflow lifecycle event constants and payloads.
 */

import type { WorkflowKind, WorkflowStatus } from '../types/workflow.types.ts';

export const WORKFLOW_EVENT = {
  BUILD_STARTED:      'workflow.build.started',
  BUILD_COMPLETED:    'workflow.build.completed',
  BUILD_FAILED:       'workflow.build.failed',
  RUNTIME_STARTED:    'workflow.runtime.started',
  RUNTIME_HEALTHY:    'workflow.runtime.healthy',
  RUNTIME_UNHEALTHY:  'workflow.runtime.unhealthy',
  TESTS_STARTED:      'workflow.tests.started',
  TESTS_COMPLETED:    'workflow.tests.completed',
  TESTS_FAILED:       'workflow.tests.failed',
  VALIDATION_STARTED: 'workflow.validation.started',
  VALIDATION_DONE:    'workflow.validation.done',
  RECOVERY_STARTED:   'workflow.recovery.started',
  RECOVERY_DONE:      'workflow.recovery.done',
} as const;

export type WorkflowEventName = typeof WORKFLOW_EVENT[keyof typeof WORKFLOW_EVENT];

export interface WorkflowLifecyclePayload {
  runId:      string;
  projectId:  string;
  kind:       WorkflowKind;
  status:     WorkflowStatus;
  durationMs?: number;
  errors?:    string[];
  timestamp:  Date;
}
