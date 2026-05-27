/**
 * server/tools/registry/index.ts
 *
 * Public surface of the tool registry layer.
 * Import everything through this barrel — not from individual files.
 */

// Types
export type {
  ToolCategory,
  ToolPermission,
  ToolDefinition,
  ToolExecutionContext,
  ToolExecutionResult,
  ToolErrorCode,
  ToolHandler,
  ToolRegistrationEntry,
  RetryPolicy,
  ToolInputSchema,
  ToolOutputSchema,
  FieldSchema,
} from './tool-types.ts';

// Metadata
export {
  registerMetadata,
  getMetadata,
  getAllMetadata,
  getMetadataByCategory,
  hasMetadata,
  metadataCatalogueSize,
  RETRY_NONE,
  RETRY_ONCE,
  RETRY_AGGRESSIVE,
  TIMEOUT,
} from './tool-metadata.ts';
export type { ToolMetadata } from './tool-metadata.ts';

// Registry
export {
  registerTool,
  unregisterTool,
  getTool,
  listTools,
  listToolsByCategory,
  hasTool,
  toolCount,
  sealRegistry,
  isSealed,
  _resetRegistryForTests,
  ToolRegistryError,
} from './tool-registry.ts';

// Resolver
export {
  resolveTool,
  resolveToolWithPermissions,
  toolExists,
  validateToolName,
  ToolNotFoundError,
  ToolPermissionError,
} from './tool-resolver.ts';
export type { ResolvedTool } from './tool-resolver.ts';

// Dispatcher
export {
  dispatch,
  dispatchAll,
  dispatchSequential,
} from './tool-dispatcher.ts';
export type { DispatchOptions } from './tool-dispatcher.ts';

// Security / audit
export {
  recordAudit,
  getAuditLog,
  clearAuditLog,
  auditStats,
} from './tool-security.ts';
export type { AuditLogEntry } from './tool-security.ts';

// Metrics (extracted from registry — Fix #8)
export {
  recordMetric,
  getMetrics,
  getAllMetricsSnapshot,
  resetMetrics,
} from './tool-metrics.ts';
export type { ToolMetrics } from './tool-metrics.ts';

// Type-safe tool definition helper (Fix #15)
export { defineTool, defineCodingTool } from './define-tool.ts';

// Compat shim (preserved for backward compat — consumers migrate to dispatch())
export { unifiedRegistry } from './tool-registry.ts';
export type { UnifiedRegistryEntry } from './tool-registry.ts';
