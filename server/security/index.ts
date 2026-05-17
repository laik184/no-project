/**
 * server/security/index.ts
 *
 * Public entry point for the security layer.
 * Exposes the inspector API router and re-exports key utilities.
 */

import { Router, type Request, type Response } from "express";
import { getExecutionAudit, getBlockedExecutions } from "./execution-policy.ts";
import { SAFE_COMMANDS } from "./command-validator.ts";

export { validateCommand, validateArgs, validatePackageName, validateSandboxCwd, SAFE_COMMANDS } from "./command-validator.ts";
export { filterEnv, safeSpawn }                from "./safe-spawn.ts";
export { shellExecPreFlight, validatePackageInstallArgs, recordExecution } from "./execution-policy.ts";
export {
  isSecretKey, redactEnvRecord, sanitizeString,
  sanitizeObject, sanitizeForLlm, sanitizeToolResultJson,
  REDACTED, SECRET_KEY_RE,
} from "./secret-redactor.ts";

/**
 * Inspector API — read-only endpoints for auditing shell execution history.
 *
 * GET /api/security/audit          — recent execution log (last 50)
 * GET /api/security/audit/blocked  — only blocked/rejected attempts
 * GET /api/security/policy         — current command allowlist + policies
 */
export function createSecurityRouter(): Router {
  const router = Router();

  router.get("/audit", (_req: Request, res: Response) => {
    const limit = Math.min(Number(_req.query["limit"]) || 50, 200);
    res.json({ ok: true, entries: getExecutionAudit(limit) });
  });

  router.get("/audit/blocked", (_req: Request, res: Response) => {
    const limit = Math.min(Number(_req.query["limit"]) || 50, 200);
    res.json({ ok: true, entries: getBlockedExecutions(limit) });
  });

  router.get("/policy", (_req: Request, res: Response) => {
    res.json({
      ok: true,
      allowedCommands:    [...SAFE_COMMANDS],
      forbiddenFlags: {
        node:      ["-e", "--eval", "-p", "--print"],
        tsx:       ["-e", "--eval"],
        python:    ["-c", "--command"],
        python3:   ["-c", "--command"],
        npm:       ["--prefix"],
        npx:       ["--yes", "-y"],
        git:       ["--exec-path", "--upload-pack", "--receive-pack"],
      },
      allowedNpmSubcommands: [
        "install", "uninstall", "run", "start", "test", "build",
        "audit", "ci", "list", "ls", "view", "info", "update", "outdated",
      ],
      allowedNpxPackages: [
        "tsc", "eslint", "prettier", "drizzle-kit", "prisma",
        "vite", "create-vite", "create-react-app",
      ],
      blockedFromAllCommands: ["curl", "wget", "node", "python", "python3", "env", "printenv"],
      envFiltering: "secrets redacted (DATABASE_URL, *API_KEY, *TOKEN, *SECRET, *PASSWORD)",
    });
  });

  return router;
}
