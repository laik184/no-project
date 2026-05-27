export class TerminalError extends Error {
  constructor(
    message:        string,
    public readonly code:    string,
    public readonly command?: string,
  ) {
    super(message);
    this.name = 'TerminalError';
  }
}

export class CommandBlockedError extends TerminalError {
  constructor(command: string, reason: string) {
    super(`Command blocked: ${reason}`, 'COMMAND_BLOCKED', command);
    this.name = 'CommandBlockedError';
  }
}

export class CommandTimeoutError extends TerminalError {
  constructor(command: string, timeoutMs: number) {
    super(`Command timed out after ${timeoutMs}ms`, 'TIMEOUT', command);
    this.name = 'CommandTimeoutError';
  }
}

export class SandboxViolationError extends TerminalError {
  constructor(path: string) {
    super(`Path escapes sandbox: ${path}`, 'SANDBOX_VIOLATION');
    this.name = 'SandboxViolationError';
  }
}

export class NpmValidationError extends TerminalError {
  constructor(pkg: string, reason: string) {
    super(`Invalid package "${pkg}": ${reason}`, 'NPM_VALIDATION_ERROR');
    this.name = 'NpmValidationError';
  }
}

export class ProcessNotFoundError extends TerminalError {
  constructor(id: string) {
    super(`Process not found: ${id}`, 'PROCESS_NOT_FOUND');
    this.name = 'ProcessNotFoundError';
  }
}
