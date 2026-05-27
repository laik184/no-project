export class VerifierError extends Error {
  constructor(
    message:        string,
    public readonly code:    string,
    public readonly phase?:  string,
    public readonly runId?:  string,
  ) {
    super(message);
    this.name = 'VerifierError';
  }
}

export class BuildFailedError extends VerifierError {
  constructor(runId: string, detail: string) {
    super(`Build failed: ${detail}`, 'BUILD_FAILED', 'build', runId);
    this.name = 'BuildFailedError';
  }
}

export class TypecheckFailedError extends VerifierError {
  constructor(runId: string, errorCount: number) {
    super(`Typecheck failed: ${errorCount} error(s)`, 'TYPECHECK_FAILED', 'typecheck', runId);
    this.name = 'TypecheckFailedError';
  }
}

export class TestFailedError extends VerifierError {
  constructor(runId: string, failed: number) {
    super(`Tests failed: ${failed} test(s)`, 'TESTS_FAILED', 'tests', runId);
    this.name = 'TestFailedError';
  }
}

export class RuntimeUnhealthyError extends VerifierError {
  constructor(runId: string, detail: string) {
    super(`Runtime unhealthy: ${detail}`, 'RUNTIME_UNHEALTHY', 'runtime', runId);
    this.name = 'RuntimeUnhealthyError';
  }
}

export class VerifierTimeoutError extends VerifierError {
  constructor(phase: string, timeoutMs: number) {
    super(`Phase "${phase}" timed out after ${timeoutMs}ms`, 'TIMEOUT', phase);
    this.name = 'VerifierTimeoutError';
  }
}

export class SandboxNotReadyError extends VerifierError {
  constructor(projectId: string) {
    super(`Sandbox not ready for project: ${projectId}`, 'SANDBOX_NOT_READY');
    this.name = 'SandboxNotReadyError';
  }
}
