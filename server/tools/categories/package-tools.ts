import { getProjectDir } from "../../infrastructure/sandbox/sandbox.util.ts";
import type { Tool, ToolContext, ToolResult } from "../types.ts";
import { spawnWithStream } from "../runtime/shell-log-emitter.ts";
import { validatePackageInstallArgs } from "../../security/execution-policy.ts";

async function runNpm(
  npmArgs:   string[],
  cwd:       string,
  projectId: number,
  signal?:   AbortSignal,
): Promise<{ exitCode: number | null; stdout: string; stderr: string }> {
  if (signal?.aborted) return { exitCode: 1, stdout: "", stderr: "Aborted" };
  const result = await spawnWithStream({ command: "npm", args: npmArgs, cwd, projectId, timeoutMs: 120_000 });
  return { exitCode: result.exitCode, stdout: result.stdout, stderr: result.stderr };
}

export const packageInstall: Tool = {
  name: "package_install",
  description: "Install npm packages. Streams install progress live to the console. Pass empty packages array to run npm install with existing package.json.",
  parameters: {
    type: "object",
    properties: {
      packages: { type: "array", items: { type: "string" }, description: "Package names to install" },
      dev:      { type: "boolean", description: "Install as devDependencies" },
    },
  },
  async run(args, ctx: ToolContext): Promise<ToolResult> {
    const projectDir = getProjectDir(ctx.projectId);
    const pkgs       = (args.packages as string[]) || [];

    // Validate every package name before passing to npm
    if (pkgs.length > 0) {
      const pkgCheck = validatePackageInstallArgs(pkgs);
      if (!pkgCheck.valid) return { ok: false, error: `Blocked: ${pkgCheck.reason}` };
      const safePkgs = pkgCheck.cleaned!;
      const npmArgs  = ["install", ...(args.dev ? ["--save-dev"] : []), ...safePkgs];
      const { exitCode, stdout, stderr } = await runNpm(npmArgs, projectDir, ctx.projectId, ctx.signal);
      return {
        ok:     exitCode === 0,
        result: { installed: safePkgs, exitCode, stdout, stderr },
        error:  exitCode !== 0 ? stderr.slice(0, 500) : undefined,
      };
    }

    const npmArgs = ["install"];
    const { exitCode, stdout, stderr } = await runNpm(npmArgs, projectDir, ctx.projectId, ctx.signal);
    return {
      ok:     exitCode === 0,
      result: { installed: [], exitCode, stdout, stderr },
      error:  exitCode !== 0 ? stderr.slice(0, 500) : undefined,
    };
  },
};

export const packageUninstall: Tool = {
  name: "package_uninstall",
  description: "Uninstall npm packages from the project. Streams output live to the console.",
  parameters: {
    type: "object",
    properties: {
      packages: { type: "array", items: { type: "string" }, description: "Package names to uninstall" },
    },
    required: ["packages"],
  },
  async run(args, ctx: ToolContext): Promise<ToolResult> {
    const projectDir = getProjectDir(ctx.projectId);
    const pkgs       = args.packages as string[];
    if (!pkgs.length) return { ok: false, error: "No packages specified" };
    const pkgCheck = validatePackageInstallArgs(pkgs);
    if (!pkgCheck.valid) return { ok: false, error: `Blocked: ${pkgCheck.reason}` };
    const safePkgs = pkgCheck.cleaned!;
    const { exitCode, stdout, stderr } = await runNpm(["uninstall", ...safePkgs], projectDir, ctx.projectId, ctx.signal);
    return {
      ok:     exitCode === 0,
      result: { uninstalled: pkgs, exitCode, stdout, stderr },
      error:  exitCode !== 0 ? stderr.slice(0, 500) : undefined,
    };
  },
};

export const packageAudit: Tool = {
  name: "package_audit",
  description: "Run npm audit to check for security vulnerabilities in dependencies.",
  parameters: {
    type: "object",
    properties: {
      fix: { type: "boolean", description: "Automatically fix vulnerabilities (default false)" },
    },
  },
  async run(args, ctx: ToolContext): Promise<ToolResult> {
    const projectDir = getProjectDir(ctx.projectId);
    const npmArgs    = args.fix ? ["audit", "fix"] : ["audit", "--json"];
    const { exitCode, stdout, stderr } = await runNpm(npmArgs, projectDir, ctx.projectId, ctx.signal);
    let auditResult: unknown = stdout;
    if (!args.fix) { try { auditResult = JSON.parse(stdout); } catch { auditResult = stdout; } }
    return { ok: true, result: { exitCode, audit: auditResult, stderr } };
  },
};

export const detectMissingPackages: Tool = {
  name: "detect_missing_packages",
  description: "Scan recent server logs for 'Cannot find module X' errors and return missing npm package names.",
  parameters: { type: "object", properties: {} },
  async run(_args, _ctx: ToolContext): Promise<ToolResult> {
    const missing = new Set<string>();
    return {
      ok: true,
      result: {
        missing: [...missing],
        message: missing.size === 0
          ? "No missing packages detected in recent logs."
          : `Found ${missing.size} missing packages: ${[...missing].join(", ")}`,
      },
    };
  },
};
