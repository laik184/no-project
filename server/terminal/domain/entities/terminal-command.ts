/**
 * server/terminal/domain/entities/terminal-command.ts
 *
 * TerminalCommand domain entity — represents one executed command.
 */

export interface TerminalCommand {
  id:         string;
  sessionId:  string;
  projectId:  number;
  command:    string;
  exitCode:   number | null;
  stdout:     string;
  stderr:     string;
  startedAt:  number;
  endedAt:    number | null;
  timedOut:   boolean;
}

export function createCommand(
  id:        string,
  sessionId: string,
  projectId: number,
  command:   string,
): TerminalCommand {
  return {
    id,
    sessionId,
    projectId,
    command,
    exitCode:  null,
    stdout:    '',
    stderr:    '',
    startedAt: Date.now(),
    endedAt:   null,
    timedOut:  false,
  };
}

export function completeCommand(
  cmd:      TerminalCommand,
  exitCode: number,
  stdout:   string,
  stderr:   string,
  timedOut: boolean,
): TerminalCommand {
  return { ...cmd, exitCode, stdout, stderr, timedOut, endedAt: Date.now() };
}
