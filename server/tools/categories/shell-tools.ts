import { getProjectDir } from "../../infrastructure/sandbox/sandbox.util.ts";
import type { Tool, ToolContext, ToolResult } from "../types.ts";
import { spawnWithStream } from "../runtime/shell-log-emitter.ts";
import { ALLOWED_COMMANDS } from "../registry/tool-security.ts";
import { shellExecPreFlight, recordExecution } from "../../security/execution-policy.ts";
import { validateSandboxCwd } from "../../security/command-validator.ts";

export { ALLOWED_COMMANDS };

export const shellExec: Tool = {
  name: "shell_exec",
  description: "Run an allow-listed shell command in the project sandbox. Streams stdout/stderr live to the console. Returns exit code and output.",
  parameters: {
    type: "object",
    properties: {
      command:   { type: "string",  description: "Command to run (e.g. 'npm')" },
      args:      { type: "array",   items: { type: "string" }, description: "Arguments array (e.g. ['run', 'dev'])" },
      timeoutMs: { type: "number",  description: "Timeout in ms (default 30000)" },
      cwd:       { type: "string",  description: "Working directory relative to project root (default: project root)" },
    },
    required: ["command"],
  },

  async run(args, ctx: ToolContext): Promise<ToolResult> {
    const command    = String(args.command ?? "").trim();
    const cmdArgs    = (Array.isArray(args.args) ? args.args : []).map(String);
    const timeoutMs  = Math.min(Number(args.timeoutMs) || 30_000, 120_000);
    const projectDir = getProjectDir(ctx.projectId);

    // Validate cwd stays inside sandbox
    const cwdRaw = args.cwd ? `${projectDir}/${args.cwd}` : projectDir;
    const cwdCheck = validateSandboxCwd(cwdRaw, projectDir);
    if (!cwdCheck.valid) {
      recordExecution({ ts: Date.now(), command, args: cmdArgs, projectId: ctx.projectId, runId: ctx.runId, blocked: true, reason: cwdCheck.reason });
      return { ok: false, error: cwdCheck.reason };
    }

    // Pre-flight: command allowlist + per-arg metachar + arg policies + URL check
    const preflight = shellExecPreFlight(command, cmdArgs);
    if (!preflight.valid) {
      recordExecution({ ts: Date.now(), command, args: cmdArgs, projectId: ctx.projectId, runId: ctx.runId, blocked: true, reason: preflight.reason });
      return { ok: false, error: `Blocked: ${preflight.reason}` };
    }

    const start = Date.now();
    const { exitCode, stdout, stderr, timedOut } = await spawnWithStream({
      command,
      args: cmdArgs,
      cwd:  cwdRaw,
      projectId: ctx.projectId,
      timeoutMs,
    });

    recordExecution({ ts: start, command, args: cmdArgs, projectId: ctx.projectId, runId: ctx.runId, blocked: false, exitCode, durationMs: Date.now() - start });

    return {
      ok: exitCode === 0 && !timedOut,
      result: { exitCode: timedOut ? -1 : exitCode, stdout, stderr, timedOut },
      error: (exitCode !== 0 && !timedOut) ? (stderr || `Exit code ${exitCode}`).slice(0, 500) : undefined,
    };
  },
};
