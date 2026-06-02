/**
 * server/repositories/index.ts
 *
 * Root repository barrel.
 * Re-exports all domain repositories from their canonical location.
 *
 * Imported by:
 *   server/services/filesystem/**   — service layer
 *   server/file-explorer/repositories/index.ts  — backward-compat re-export
 *
 * ARCHITECTURE RULE:
 *   Only repositories are exported here. No services, orchestrators, or controllers.
 */

export * from './file-system/index.ts';
