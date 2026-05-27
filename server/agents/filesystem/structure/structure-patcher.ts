import { readStructure } from './structure-reader.ts';
import { writeFile } from '../files/file-writer.ts';
import { createFolder } from '../folders/folder-creator.ts';
import { deleteFileFromSandbox } from '../files/file-deleter.ts';
import { deleteFolder } from '../folders/folder-deleter.ts';
import { assertRelativePath } from '../validation/path-validator.ts';

export type PatchOperationType = 'add_file' | 'update_file' | 'delete_file' | 'add_folder' | 'delete_folder';

export interface StructurePatchOp {
  type: PatchOperationType;
  path: string;
  content?: string;
}

export interface StructurePatchResult {
  applied: StructurePatchOp[];
  failed: Array<{ op: StructurePatchOp; error: string }>;
}

async function applyOp(
  sandboxRoot: string,
  op: StructurePatchOp,
): Promise<void> {
  assertRelativePath(op.path);

  switch (op.type) {
    case 'add_file':
    case 'update_file': {
      if (op.content === undefined) throw new Error(`content is required for ${op.type}`);
      await writeFile({ sandboxRoot, path: op.path, content: op.content });
      break;
    }
    case 'delete_file': {
      await deleteFileFromSandbox({ sandboxRoot, path: op.path, mustExist: false });
      break;
    }
    case 'add_folder': {
      await createFolder({ sandboxRoot, path: op.path, recursive: true });
      break;
    }
    case 'delete_folder': {
      await deleteFolder({ sandboxRoot, path: op.path, mustExist: false });
      break;
    }
    default:
      throw new Error(`Unknown patch operation type: ${(op as StructurePatchOp).type}`);
  }
}

export async function patchStructure(
  sandboxRoot: string,
  ops: StructurePatchOp[],
): Promise<StructurePatchResult> {
  const result: StructurePatchResult = { applied: [], failed: [] };

  for (const op of ops) {
    try {
      await applyOp(sandboxRoot, op);
      result.applied.push(op);
    } catch (err) {
      result.failed.push({ op, error: (err as Error).message });
    }
  }

  return result;
}
