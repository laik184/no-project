export { initializeFilesystemAgent, filesystemEngine } from './filesystem-agent.ts';

export { workspaceManager }  from '../../tools/filesystem/lib/workspace/workspace-manager.ts';
export { isolationManager }  from '../../tools/filesystem/lib/workspace/isolation-manager.ts';
export { snapshotManager }   from '../../tools/filesystem/lib/workspace/snapshot-manager.ts';
export { workspaceHistory }  from '../../tools/filesystem/lib/workspace/workspace-history.ts';
export { permissionManager } from '../../tools/filesystem/lib/permissions.ts';

export type { WorkspaceInfo }    from '../../tools/filesystem/lib/workspace/workspace-manager.ts';
export type { IsolationContext } from '../../tools/filesystem/lib/workspace/isolation-manager.ts';
export type { HistoryEntry }     from '../../tools/filesystem/lib/workspace/workspace-history.ts';
export type { OperationRequest, OperationResult } from './types/operation.types.ts';
export type { FilesystemAgentState, OperationType, OperationRecord } from './types/filesystem.types.ts';
