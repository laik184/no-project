/**
 * server/sandbox/index.ts
 * Public API for the sandbox isolation system.
 */

export { createSandbox, executeSandboxed, destroySandbox, getSandboxReport } from "./runtime/sandbox-manager.ts";
export { validateCommand }        from "./runtime/command-whitelist.ts";
export { limitProcess }           from "./runtime/process-limiter.ts";
export { isolateAndValidate, buildBlockedResult } from "./runtime/execution-isolator.ts";
export { guardFilesystem, guardBatchPaths }        from "./filesystem/filesystem-guard.ts";
export { checkNetworkAccess, batchCheckNetwork }   from "./security/network-policy.ts";
export { monitorResources, getResourceHistory }    from "./security/resource-monitor.ts";
export type {
  SandboxConstraints, SandboxExecutionRequest, SandboxExecutionResult,
  SandboxReport, SandboxStatus, ResourceUsage,
} from "./types.ts";
