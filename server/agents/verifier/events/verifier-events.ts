export const VERIFIER_EVENTS = {
  STARTED:   'verification.started',
  COMPLETED: 'verification.completed',
  FAILED:    'verification.failed',
} as const;

export const BUILD_EVENTS = {
  STARTED: 'build.started',
  PASSED:  'build.passed',
  FAILED:  'build.failed',
} as const;

export const RUNTIME_EVENTS = {
  STARTED:  'runtime.check.started',
  HEALTHY:  'runtime.healthy',
  CRASHED:  'runtime.crashed',
} as const;

export const TEST_EVENTS = {
  STARTED: 'tests.started',
  PASSED:  'tests.passed',
  FAILED:  'tests.failed',
} as const;

export type VerifierEventName =
  | typeof VERIFIER_EVENTS[keyof typeof VERIFIER_EVENTS]
  | typeof BUILD_EVENTS[keyof typeof BUILD_EVENTS]
  | typeof RUNTIME_EVENTS[keyof typeof RUNTIME_EVENTS]
  | typeof TEST_EVENTS[keyof typeof TEST_EVENTS];
