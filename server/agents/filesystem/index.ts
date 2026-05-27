import { workspaceManager }  from '../../tools/filesystem/lib/workspace/workspace-manager.ts';
import { isolationManager }  from '../../tools/filesystem/lib/workspace/isolation-manager.ts';
import { snapshotManager }   from '../../tools/filesystem/lib/workspace/snapshot-manager.ts';
import { workspaceHistory }  from '../../tools/filesystem/lib/workspace/workspace-history.ts';
import { permissionManager } from '../../tools/filesystem/lib/permissions.ts';

export {
  workspaceManager,
  isolationManager,
  snapshotManager,
  workspaceHistory,
  permissionManager,
};

export type { WorkspaceInfo }    from '../../tools/filesystem/lib/workspace/workspace-manager.ts';
export type { IsolationContext } from '../../tools/filesystem/lib/workspace/isolation-manager.ts';
export type { HistoryEntry }     from '../../tools/filesystem/lib/workspace/workspace-history.ts';
