import { createFilesystemContext, releaseFilesystemContext } from './filesystem-context.ts';
import { filesystemSession }  from './filesystem-session.ts';
import { filesystemState }    from './filesystem-state.ts';
import { emitAgentReady }     from '../events/filesystem-events.ts';
import type { OperationRequest, OperationResult } from '../types/operation.types.ts';
import { readOperation }      from '../operations/read-operation.ts';
import { writeOperation }     from '../operations/write-operation.ts';
import { deleteOperation }    from '../operations/delete-operation.ts';
import { searchOperation }    from '../operations/search-operation.ts';
import { filesystemLogger }   from '../telemetry/filesystem-logger.ts';
import { filesystemMetrics }  from '../telemetry/filesystem-metrics.ts';
import { validateOperation }  from '../validation/operation-validator.ts';

class FilesystemEngine {
  async initSession(runId: string, projectId: string): Promise<void> {
    if (filesystemSession.has(runId)) return;

    const ctx = await createFilesystemContext(runId, projectId);
    filesystemSession.set(runId, ctx);
    filesystemState.init(runId, projectId, ctx.sandboxRoot);
    emitAgentReady({ runId, projectId, sandboxRoot: ctx.sandboxRoot });
    filesystemLogger.info(runId, `Filesystem agent session started — sandbox: ${ctx.sandboxRoot}`);
  }

  closeSession(runId: string): void {
    const session = filesystemSession.get(runId);
    if (!session) return;

    releaseFilesystemContext(runId, session.ctx.state.projectId);
    filesystemSession.delete(runId);
    filesystemState.clear(runId);
    filesystemLogger.info(runId, 'Filesystem agent session closed');
  }

  async execute(req: OperationRequest): Promise<OperationResult> {
    const start = Date.now();

    const validationError = validateOperation(req);
    if (validationError) {
      return { id: req.id, type: req.type, success: false, error: validationError, durationMs: 0 };
    }

    const session = filesystemSession.get(req.runId);
    if (!session) {
      await this.initSession(req.runId, req.projectId);
    }

    const sandboxRoot = filesystemSession.get(req.runId)!.ctx.sandboxRoot;

    filesystemLogger.info(req.runId, `[${req.type}] ${req.path}`);
    filesystemMetrics.recordStart(req.runId, req.type);

    let result: OperationResult;

    try {
      switch (req.type) {
        case 'read_file':
          result = await readOperation.readFile(req, sandboxRoot);
          break;
        case 'read_folder':
          result = await readOperation.readFolder(req, sandboxRoot);
          break;
        case 'write_file':
          result = await writeOperation.writeFile(req, sandboxRoot);
          break;
        case 'patch_file':
          result = await writeOperation.patchFile(req, sandboxRoot);
          break;
        case 'delete_file':
          result = await deleteOperation.deleteFile(req, sandboxRoot);
          break;
        case 'delete_folder':
          result = await deleteOperation.deleteFolder(req, sandboxRoot);
          break;
        case 'search_text':
          result = await searchOperation.searchText(req, sandboxRoot);
          break;
        case 'search_regex':
          result = await searchOperation.searchRegex(req, sandboxRoot);
          break;
        default:
          result = { id: req.id, type: req.type, success: false, error: `Unsupported operation: ${req.type}`, durationMs: 0 };
      }
    } catch (err) {
      result = {
        id: req.id, type: req.type, success: false,
        error: err instanceof Error ? err.message : String(err),
        durationMs: Date.now() - start,
      };
    }

    result.durationMs = Date.now() - start;
    filesystemMetrics.recordEnd(req.runId, req.type, result.success);
    filesystemState.increment(req.runId, result.success ? 'opsCompleted' : 'opsFailed');
    return result;
  }
}

export const filesystemEngine = new FilesystemEngine();
