/**
 * server/repositories/file-system/index.ts
 *
 * Domain-level repository barrel.
 * All repositories are domain-owned here — not feature-owned.
 *
 * Consumers:
 *   server/services/filesystem/**  — service layer (via server/repositories/index.ts)
 *   server/file-explorer/**        — re-exported via file-explorer/repositories/index.ts
 */

// ── Repositories ───────────────────────────────────────────────────────────────

export { filesystemRepository } from './filesystem/filesystem.repository.ts';
export { gitRepository }        from './git/git.repository.ts';
export { metadataRepository }   from './metadata/metadata.repository.ts';
export { historyRepository }    from './history/history.repository.ts';
export { recentRepository }     from './recent/recent.repository.ts';
export { pinnedRepository }     from './pinned/pinned.repository.ts';
export { editorsRepository }    from './editors/editors.repository.ts';

// ── Filesystem Services ────────────────────────────────────────────────────────

export { clipboardService }          from '../../services/filesystem/clipboard/index.ts';
export { createService }             from '../../services/filesystem/create/index.ts';
export { deleteService }             from '../../services/filesystem/delete/index.ts';
export { dependencyAnalysisService } from '../../services/filesystem/dependency-analysis/index.ts';
export type { ImportEntry, ExportEntry, UsageEntry, DependencyAnalysisResult } from '../../services/filesystem/dependency-analysis/index.ts';
export { downloadService }           from '../../services/filesystem/download/index.ts';
export { duplicateService }          from '../../services/filesystem/duplicate/index.ts';
export { gitStatusService }          from '../../services/filesystem/git-status/index.ts';
export type { GitStatusCode }        from '../../services/filesystem/git-status/index.ts';
export { historyService }            from '../../services/filesystem/history/index.ts';
export { insightsService }           from '../../services/filesystem/insights/index.ts';
export { metadataService }           from '../../services/filesystem/metadata/index.ts';
export { openEditorsService }        from '../../services/filesystem/open-editors/index.ts';
export { pinnedService }             from '../../services/filesystem/pinned/index.ts';
export { readService }               from '../../services/filesystem/read/index.ts';
export { recentService }             from '../../services/filesystem/recent/index.ts';
export { renameService }             from '../../services/filesystem/rename/index.ts';
export { scannerService }            from '../../services/filesystem/scanner/index.ts';
export type { ScanEntry, ScanResult, ScanWithFiltersOptions, CountResult } from '../../services/filesystem/scanner/index.ts';
export { searchService }             from '../../services/filesystem/search/index.ts';
export { treeService }               from '../../services/filesystem/tree/index.ts';
export { uploadService }             from '../../services/filesystem/upload/index.ts';
export { writeService }              from '../../services/filesystem/write/index.ts';
