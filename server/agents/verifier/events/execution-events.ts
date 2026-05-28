/**
 * events/execution-events.ts
 * Execution-level event constants for tool dispatch tracking.
 */

export const EXECUTION_EVENT = {
  DISPATCH_START:    'execution.dispatch.start',
  DISPATCH_COMPLETE: 'execution.dispatch.complete',
  DISPATCH_FAILED:   'execution.dispatch.failed',
  DISPATCH_TIMEOUT:  'execution.dispatch.timeout',
  RETRY_ATTEMPT:     'execution.retry.attempt',
  RETRY_EXHAUSTED:   'execution.retry.exhausted',
} as const;

export type ExecutionEventName = typeof EXECUTION_EVENT[keyof typeof EXECUTION_EVENT];

export interface DispatchEventPayload {
  runId:      string;
  toolName:   string;
  attempt:    number;
  durationMs?: number;
  error?:     string;
  timestamp:  Date;
}

export interface RetryEventPayload {
  runId:      string;
  toolName:   string;
  attempt:    number;
  maxAttempts: number;
  delayMs:    number;
  timestamp:  Date;
}
