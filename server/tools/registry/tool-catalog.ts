/**
 * server/tools/registry/tool-catalog.ts
 *
 * Populates the unified registry with all tools.
 * ONLY place where tools are registered — imports from ../categories/ (single root).
 */

import { unifiedRegistry }    from "./tool-registry.ts";
import { CATEGORY_PERMISSIONS } from "./tool-permissions.ts";
import type { RegisteredTool }  from "./tool-types.ts";

// ── Category imports (all from server/tools/categories/) ──────────────────────

import { fileList, fileRead, fileWrite, fileDelete }                              from "../categories/file-tools.ts";
import { fileSearch, fileReplace }                                                from "../categories/file-search-tools.ts";
import { shellExec }                                                              from "../categories/shell-tools.ts";
import { packageInstall, packageUninstall, packageAudit, detectMissingPackages } from "../categories/package-tools.ts";
import { serverStart, serverStop, serverRestart, serverLogs }                    from "../categories/server-lifecycle-tools.ts";
import { previewUrl, previewScreenshot }                                          from "../categories/preview-tools.ts";
import { envRead, envWrite }                                                      from "../categories/env-tools.ts";
import { gitStatus, gitAdd, gitCommit, gitClone, gitPush, gitPull }              from "../categories/git-tools.ts";
import { dbMigrate, dbSeed, dbQuery }                                             from "../categories/db-tools.ts";
import { deployBuild, deployStatus, deployTypecheck }                            from "../categories/deploy-tools.ts";
import { testRun, testLint, testCoverage }                                        from "../categories/testing-tools.ts";
import { browserNavigate, browserClick, browserFill }                            from "../categories/browser-tools.ts";
import { networkFetch, networkPortCheck, networkDnsLookup }                      from "../categories/network-tools.ts";
import { authScaffold, authAudit }                                                from "../categories/auth-tools.ts";
import { agentWait, agentAskUser, agentEmitEvent, agentThink, agentFail }        from "../categories/agent-control-tools.ts";
import { memoryUpdate, memoryRead }                                               from "../categories/memory-tools.ts";

// ── Catalog definition ────────────────────────────────────────────────────────

const CATALOG: RegisteredTool[] = [
  // ── FILE (6) ───────────────────────────────────────────────────────────────
  { tool: fileList,              category: "file",          terminal: false, defaultTimeoutMs: 10_000,  permissions: CATEGORY_PERMISSIONS["file"] },
  { tool: fileRead,              category: "file",          terminal: false, defaultTimeoutMs: 10_000,  permissions: CATEGORY_PERMISSIONS["file"] },
  { tool: fileWrite,             category: "file",          terminal: false, defaultTimeoutMs: 10_000,  permissions: CATEGORY_PERMISSIONS["file"] },
  { tool: fileDelete,            category: "file",          terminal: false, defaultTimeoutMs: 10_000,  permissions: CATEGORY_PERMISSIONS["file"] },
  { tool: fileSearch,            category: "file",          terminal: false, defaultTimeoutMs: 15_000,  permissions: CATEGORY_PERMISSIONS["file"] },
  { tool: fileReplace,           category: "file",          terminal: false, defaultTimeoutMs: 10_000,  permissions: CATEGORY_PERMISSIONS["file"] },

  // ── SHELL (1) ──────────────────────────────────────────────────────────────
  { tool: shellExec,             category: "shell",         terminal: false, defaultTimeoutMs: 30_000,  permissions: CATEGORY_PERMISSIONS["shell"] },

  // ── PACKAGE (4) ────────────────────────────────────────────────────────────
  { tool: packageInstall,        category: "package",       terminal: false, defaultTimeoutMs: 120_000, permissions: CATEGORY_PERMISSIONS["package"] },
  { tool: packageUninstall,      category: "package",       terminal: false, defaultTimeoutMs: 60_000,  permissions: CATEGORY_PERMISSIONS["package"] },
  { tool: packageAudit,          category: "package",       terminal: false, defaultTimeoutMs: 30_000,  permissions: CATEGORY_PERMISSIONS["package"] },
  { tool: detectMissingPackages, category: "package",       terminal: false, defaultTimeoutMs: 10_000,  permissions: CATEGORY_PERMISSIONS["package"] },

  // ── SERVER LIFECYCLE (4) ───────────────────────────────────────────────────
  { tool: serverStart,           category: "server",        terminal: false, defaultTimeoutMs: 15_000,  permissions: CATEGORY_PERMISSIONS["server"] },
  { tool: serverStop,            category: "server",        terminal: false, defaultTimeoutMs: 10_000,  permissions: CATEGORY_PERMISSIONS["server"] },
  { tool: serverRestart,         category: "server",        terminal: false, defaultTimeoutMs: 15_000,  permissions: CATEGORY_PERMISSIONS["server"] },
  { tool: serverLogs,            category: "server",        terminal: false, defaultTimeoutMs: 5_000,   permissions: CATEGORY_PERMISSIONS["server"] },

  // ── PREVIEW (2) ────────────────────────────────────────────────────────────
  { tool: previewUrl,            category: "preview",       terminal: false, defaultTimeoutMs: 5_000,   permissions: CATEGORY_PERMISSIONS["preview"] },
  { tool: previewScreenshot,     category: "preview",       terminal: false, defaultTimeoutMs: 20_000,  permissions: CATEGORY_PERMISSIONS["preview"] },

  // ── ENV (2) ────────────────────────────────────────────────────────────────
  { tool: envRead,               category: "env",           terminal: false, defaultTimeoutMs: 5_000,   permissions: CATEGORY_PERMISSIONS["env"] },
  { tool: envWrite,              category: "env",           terminal: false, defaultTimeoutMs: 5_000,   permissions: CATEGORY_PERMISSIONS["env"] },

  // ── GIT (6) ────────────────────────────────────────────────────────────────
  { tool: gitStatus,             category: "git",           terminal: false, defaultTimeoutMs: 10_000,  permissions: CATEGORY_PERMISSIONS["git"] },
  { tool: gitAdd,                category: "git",           terminal: false, defaultTimeoutMs: 10_000,  permissions: CATEGORY_PERMISSIONS["git"] },
  { tool: gitCommit,             category: "git",           terminal: false, defaultTimeoutMs: 10_000,  permissions: CATEGORY_PERMISSIONS["git"] },
  { tool: gitClone,              category: "git",           terminal: false, defaultTimeoutMs: 60_000,  permissions: CATEGORY_PERMISSIONS["git"] },
  { tool: gitPush,               category: "git",           terminal: false, defaultTimeoutMs: 30_000,  permissions: CATEGORY_PERMISSIONS["git"] },
  { tool: gitPull,               category: "git",           terminal: false, defaultTimeoutMs: 30_000,  permissions: CATEGORY_PERMISSIONS["git"] },

  // ── DATABASE (3) ───────────────────────────────────────────────────────────
  { tool: dbMigrate,             category: "db",            terminal: false, defaultTimeoutMs: 60_000,  permissions: CATEGORY_PERMISSIONS["db"] },
  { tool: dbSeed,                category: "db",            terminal: false, defaultTimeoutMs: 60_000,  permissions: CATEGORY_PERMISSIONS["db"] },
  { tool: dbQuery,               category: "db",            terminal: false, defaultTimeoutMs: 30_000,  permissions: CATEGORY_PERMISSIONS["db"] },

  // ── DEPLOY (3) ─────────────────────────────────────────────────────────────
  { tool: deployBuild,           category: "deploy",        terminal: false, defaultTimeoutMs: 120_000, permissions: CATEGORY_PERMISSIONS["deploy"] },
  { tool: deployStatus,          category: "deploy",        terminal: false, defaultTimeoutMs: 5_000,   permissions: CATEGORY_PERMISSIONS["deploy"] },
  { tool: deployTypecheck,       category: "deploy",        terminal: false, defaultTimeoutMs: 60_000,  permissions: CATEGORY_PERMISSIONS["deploy"] },

  // ── TESTING (3) ────────────────────────────────────────────────────────────
  { tool: testRun,               category: "testing",       terminal: false, defaultTimeoutMs: 60_000,  permissions: CATEGORY_PERMISSIONS["testing"] },
  { tool: testLint,              category: "testing",       terminal: false, defaultTimeoutMs: 60_000,  permissions: CATEGORY_PERMISSIONS["testing"] },
  { tool: testCoverage,          category: "testing",       terminal: false, defaultTimeoutMs: 120_000, permissions: CATEGORY_PERMISSIONS["testing"] },

  // ── BROWSER (3) ────────────────────────────────────────────────────────────
  { tool: browserNavigate,       category: "browser",       terminal: false, defaultTimeoutMs: 20_000,  permissions: CATEGORY_PERMISSIONS["browser"] },
  { tool: browserClick,          category: "browser",       terminal: false, defaultTimeoutMs: 15_000,  permissions: CATEGORY_PERMISSIONS["browser"] },
  { tool: browserFill,           category: "browser",       terminal: false, defaultTimeoutMs: 15_000,  permissions: CATEGORY_PERMISSIONS["browser"] },

  // ── NETWORK (3) ────────────────────────────────────────────────────────────
  { tool: networkFetch,          category: "network",       terminal: false, defaultTimeoutMs: 15_000,  permissions: CATEGORY_PERMISSIONS["network"] },
  { tool: networkPortCheck,      category: "network",       terminal: false, defaultTimeoutMs: 5_000,   permissions: CATEGORY_PERMISSIONS["network"] },
  { tool: networkDnsLookup,      category: "network",       terminal: false, defaultTimeoutMs: 5_000,   permissions: CATEGORY_PERMISSIONS["network"] },

  // ── AUTH (2) ───────────────────────────────────────────────────────────────
  { tool: authScaffold,          category: "auth",          terminal: false, defaultTimeoutMs: 10_000,  permissions: CATEGORY_PERMISSIONS["auth"] },
  { tool: authAudit,             category: "auth",          terminal: false, defaultTimeoutMs: 30_000,  permissions: CATEGORY_PERMISSIONS["auth"] },

  // ── AGENT CONTROL (5) ──────────────────────────────────────────────────────
  { tool: agentWait,             category: "agent-control", terminal: false, defaultTimeoutMs: 15_000,  permissions: CATEGORY_PERMISSIONS["agent-control"] },
  { tool: agentAskUser,          category: "agent-control", terminal: false, defaultTimeoutMs: 300_000, permissions: CATEGORY_PERMISSIONS["agent-control"] },
  { tool: agentEmitEvent,        category: "agent-control", terminal: false, defaultTimeoutMs: 5_000,   permissions: CATEGORY_PERMISSIONS["agent-control"] },
  { tool: agentThink,            category: "agent-control", terminal: false, defaultTimeoutMs: 5_000,   permissions: CATEGORY_PERMISSIONS["agent-control"] },
  { tool: agentFail,             category: "agent-control", terminal: true,  defaultTimeoutMs: 5_000,   permissions: CATEGORY_PERMISSIONS["agent-control"] },

  // ── MEMORY (2) ─────────────────────────────────────────────────────────────
  { tool: memoryUpdate,          category: "memory",        terminal: false, defaultTimeoutMs: 5_000,   permissions: CATEGORY_PERMISSIONS["memory"] },
  { tool: memoryRead,            category: "memory",        terminal: false, defaultTimeoutMs: 5_000,   permissions: CATEGORY_PERMISSIONS["memory"] },
];

// ── Populate registry ─────────────────────────────────────────────────────────

unifiedRegistry.registerAll(CATALOG);

console.log(`[tool-registry] Loaded ${unifiedRegistry.totalCount} tools across ${Object.keys(CATEGORY_PERMISSIONS).length} categories`);

export { CATALOG };
