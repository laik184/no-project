/**
 * server/shared/file-explorer-core/index.ts
 *
 * Shared domain primitives for the file-explorer feature.
 * Import per-category for fine-grained control, or use this barrel
 * when you need multiple categories at once.
 *
 * Consumers:
 *   server/services/filesystem/**  — service layer
 *   server/repositories/**         — repository layer
 *   server/file-explorer/**        — re-exports from here (backward compat)
 */

export * from './config/index.ts';
export * from './guards/index.ts';
export * from './contracts/index.ts';
export * from './types/index.ts';
export * from './utils/index.ts';
