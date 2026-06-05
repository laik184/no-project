/**
 * server/services/terminal/orchestration/terminal-orchestrator-service.ts
 *
 * Top-level coordinator for all terminal service operations.
 * Ties together session, command, process, runtime, streaming, logging,
 * and package-manager sub-services into a single cohesive API.
 */

import {
  terminalSessionService,
  terminalHistoryService,
} from '../session/index.ts';
import {
  commandService,
  commandValidator,
} from '../command/index.ts';
import {
  runtimeService,
} from '../runtime/index.ts';
import {
  terminalLogService,
} from '../logging/index.ts';
import {
  terminalStreamService,
} from '../streaming/index.ts';
import {
  packageService,
} from '../package-manager/index.ts';
import type { TerminalSession } from '../session/index.ts';
import type { RuntimeInfo }     from '../runtime/index.ts';

export class OrchestratorError extends Error {
  constructor(message: string) {
    super(`[terminal-orchestrator] ${message}`);
    this.name = 'OrchestratorError';
  }
}

export interface RunCommandOptions {
  stream?:    boolean;
  timeoutMs?: number;
}

export interface CommandOutput {
  sessionId:  string;
  command:    string;
  exitCode:   number;
  stdout:     string;
  stderr:     string;
  timedOut:   boolean;
  durationMs: number;
}

export const terminalOrchestratorService = {
  // ── Session management ────────────────────────────────────────────────────

  createSession(projectId: number, cwd: string, env?: Record<string, string>): TerminalSession {
    return terminalSessionService.create(projectId, cwd, env);
  },

  destroySession(sessionId: string): boolean {
    runtimeService.stop(sessionId);
    terminalLogService.clear(sessionId);
    return terminalSessionService.destroy(sessionId);
  },

  // ── Command execution ─────────────────────────────────────────────────────

  async run(sessionId: string, command: string, opts: RunCommandOptions = {}): Promise<CommandOutput> {
    const session = terminalSessionService.require(sessionId);
    commandValidator.assert(command);

    const histEntry = terminalHistoryService.push(sessionId, command);

    const execOpts = {
      cwd:         session.cwd,
      env:         session.env,
      timeoutMs:   opts.timeoutMs,
      sandboxRoot: session.cwd,
    };

    let result: CommandOutput;

    if (opts.stream) {
      const streamed = await commandService.stream(command, execOpts);
      result = { sessionId, command, ...streamed };
    } else {
      const executed = commandService.execute(command, execOpts);
      result = { sessionId, command, ...executed };
    }

    terminalHistoryService.updateExitCode(sessionId, histEntry.index, result.exitCode);

    result.stdout.split('\n').filter(Boolean).forEach(l =>
      terminalLogService.append(sessionId, l, 'stdout'),
    );
    result.stderr.split('\n').filter(Boolean).forEach(l =>
      terminalLogService.append(sessionId, l, 'stderr'),
    );

    return result;
  },

  // ── Runtime management ────────────────────────────────────────────────────

  startRuntime(sessionId: string, command: string): RuntimeInfo {
    const session = terminalSessionService.require(sessionId);
    return runtimeService.start(
      sessionId,
      command,
      session.cwd,
      session.env,
      (line, src) => terminalLogService.append(sessionId, line, src),
    );
  },

  stopRuntime(sessionId: string, force = false): boolean {
    return runtimeService.stop(sessionId, force);
  },

  async restartRuntime(sessionId: string, command?: string): Promise<RuntimeInfo> {
    const session = terminalSessionService.require(sessionId);
    return runtimeService.restart(sessionId, session.cwd, {
      command,
      env: session.env,
    });
  },

  runtimeStatus(sessionId: string): RuntimeInfo | null {
    return runtimeService.status(sessionId);
  },

  // ── Package management ────────────────────────────────────────────────────

  installPackage(sessionId: string, packageName: string, dev = false) {
    const session = terminalSessionService.require(sessionId);
    return packageService.install(packageName, session.cwd, dev);
  },

  uninstallPackage(sessionId: string, packageName: string) {
    const session = terminalSessionService.require(sessionId);
    return packageService.uninstall(packageName, session.cwd);
  },

  listPackages(sessionId: string) {
    const session = terminalSessionService.require(sessionId);
    return packageService.list(session.cwd);
  },

  // ── Log/history access ────────────────────────────────────────────────────

  getLogs(sessionId: string, limit = 200) {
    return terminalLogService.get(sessionId, limit);
  },

  getHistory(sessionId: string, limit = 50) {
    return terminalHistoryService.get(sessionId, limit);
  },

  getStream(sessionId: string) {
    return terminalStreamService.getMerged(sessionId);
  },
};
