/**
 * server/repositories/index.ts
 *
 * Domain-level repository barrel.
 * All repositories are domain-owned here — not feature-owned.
 *
 * Consumers:
 *   server/services/filesystem/**  — service layer
 *   server/file-explorer/**        — re-exported via file-explorer/repositories/index.ts
 */

export { filesystemRepository } from './filesystem/filesystem.repository.ts';
export { gitRepository }        from './git/git.repository.ts';
export { metadataRepository }   from './metadata/metadata.repository.ts';
export { historyRepository }    from './history/history.repository.ts';
export { recentRepository }     from './recent/recent.repository.ts';
export { pinnedRepository }     from './pinned/pinned.repository.ts';
export { editorsRepository }    from './editors/editors.repository.ts';
