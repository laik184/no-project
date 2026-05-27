import { writeFile as fsWrite }  from '../../../tools/filesystem/lib/files/file-writer.ts';
import { patchFile as fsPatch }  from '../../../tools/filesystem/lib/files/patch-file.ts';
import { emitFileChanged }       from '../events/filesystem-events.ts';
import type { OperationRequest, OperationResult } from '../types/operation.types.ts';

export const writeOperation = {
  async writeFile(req: OperationRequest, sandboxRoot: string): Promise<OperationResult> {
    if (!req.content) {
      return { id: req.id, type: req.type, success: false, error: 'content is required', durationMs: 0 };
    }
    const result = await fsWrite({ sandboxRoot, path: req.path, content: req.content });
    emitFileChanged({ runId: req.runId, projectId: req.projectId, path: req.path, changeType: result.skipped ? 'updated' : 'created' });
    return { id: req.id, type: req.type, success: true, output: req.path, durationMs: 0 };
  },

  async patchFile(req: OperationRequest, sandboxRoot: string): Promise<OperationResult> {
    if (req.oldString === undefined || req.newString === undefined) {
      return { id: req.id, type: req.type, success: false, error: 'oldString and newString are required', durationMs: 0 };
    }
    const result = await fsPatch({ sandboxRoot, path: req.path, oldString: req.oldString, newString: req.newString });
    emitFileChanged({ runId: req.runId, projectId: req.projectId, path: req.path, changeType: 'updated' });
    return { id: req.id, type: req.type, success: true, output: `Replaced ${result.occurrences} occurrence(s)`, durationMs: 0 };
  },
};
