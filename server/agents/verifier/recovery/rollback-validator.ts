import { promises as fs } from 'node:fs';
import path               from 'node:path';
import { verifierLogger } from '../telemetry/verifier-logger.ts';

export interface RollbackValidationResult {
  valid:   boolean;
  errors:  string[];
  checked: string[];
}

const REQUIRED_FILES = ['package.json'];
const REQUIRED_DIRS  = ['node_modules'];

export async function validateRollback(
  runId:       string,
  sandboxRoot: string,
): Promise<RollbackValidationResult> {
  const errors:  string[] = [];
  const checked: string[] = [];

  for (const file of REQUIRED_FILES) {
    const filePath = path.join(sandboxRoot, file);
    checked.push(file);
    try {
      await fs.access(filePath);
    } catch {
      errors.push(`Required file missing after rollback: ${file}`);
    }
  }

  for (const dir of REQUIRED_DIRS) {
    const dirPath = path.join(sandboxRoot, dir);
    checked.push(dir);
    try {
      const stat = await fs.stat(dirPath);
      if (!stat.isDirectory()) {
        errors.push(`Expected directory after rollback: ${dir}`);
      }
    } catch {
      errors.push(`Required directory missing after rollback: ${dir}`);
    }
  }

  const valid = errors.length === 0;
  verifierLogger.info(runId, `[rollback-validator] ${valid ? 'valid' : 'invalid'}`, { errors });
  return { valid, errors, checked };
}

export async function sandboxExists(sandboxRoot: string): Promise<boolean> {
  try {
    const stat = await fs.stat(sandboxRoot);
    return stat.isDirectory();
  } catch {
    return false;
  }
}
