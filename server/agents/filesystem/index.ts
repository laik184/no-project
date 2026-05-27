/**
 * filesystem agent — public API
 * Handles all file I/O and sandbox security for the Executor Agent system.
 */

export { fileWriter }         from './file-writer.ts';
export { fileReader }         from './file-reader.ts';
export { fileEditor }         from './file-editor.ts';
export { patchFile, patchFileAll } from './patch-file.ts';
export { safeDelete }         from './safe-delete.ts';
export { fileSearch }         from './file-search.ts';
export { readDirectory, formatListing } from './directory-reader.ts';
export { grepLiteral, grepRegex }       from './grep-search.ts';
export { pathManager }        from './path-manager.ts';
export { workspaceManager }   from './workspace-manager.ts';
export { isolationManager }   from './isolation-manager.ts';
export { permissionManager }  from './permission-manager.ts';
export { sandboxValidator, validateSandboxPath } from './sandbox-validator.ts';
export type { IsolatedContext } from './isolation-manager.ts';
