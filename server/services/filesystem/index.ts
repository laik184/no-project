// ── Services ──────────────────────────────────────────────────────────────────
export { treeService }               from "./tree/index.ts";
export { readService }               from "./read/index.ts";
export { writeService }              from "./write/index.ts";
export { createService }             from "./create/index.ts";
export { renameService }             from "./rename/index.ts";
export { deleteService }             from "./delete/index.ts";
export { duplicateService }          from "./duplicate/index.ts";
export { uploadService }             from "./upload/index.ts";
export { downloadService }           from "./download/index.ts";
export { searchService }             from "./search/index.ts";
export { metadataService }           from "./metadata/index.ts";
export { clipboardService }          from "./clipboard/index.ts";
export { historyService }            from "./history/index.ts";
export { recentService }             from "./recent/index.ts";
export { pinnedService }             from "./pinned/index.ts";
export { openEditorsService }        from "./open-editors/index.ts";
export { gitStatusService }          from "./git-status/index.ts";
export { insightsService }           from "./insights/index.ts";
export { dependencyAnalysisService } from "./dependency-analysis/index.ts";
export { scannerService }            from "./scanner/index.ts";

// ── Repositories ──────────────────────────────────────────────────────────────
// All filesystem-domain repositories re-exported as a unified surface.
// Services already import these via relative paths; external consumers
// (file-explorer, agents, tools) should import from here instead.
export {
  filesystemRepository,  // fs I/O — read, write, stat, walk, copy, rename, remove
  gitRepository,         // child_process git — status, isGitRepo
  metadataRepository,    // in-memory LRU stat cache — get, set, invalidate, clear
  historyRepository,     // .nura/history/ JSON store — getHistory, addEntry, clearHistory
  recentRepository,      // .nura/recent.json store — getAll, add, clear
  pinnedRepository,      // .nura/pinned.json store — getAll, add, remove, clear
  editorsRepository,     // .nura/editors.json store — getAll, open, close, closeAll
} from '../../repositories/file-system/index.ts';

// ── Repository Types ───────────────────────────────────────────────────────────
export type { FileWalkRecord }              from '../../repositories/file-system/filesystem/filesystem.repository.ts';
export type { GitStatusCode, GitStatusMap } from '../../repositories/file-system/git/git.repository.ts';
