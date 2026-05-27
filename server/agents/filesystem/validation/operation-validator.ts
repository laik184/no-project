import type { OperationRequest } from '../types/operation.types.ts';

export function validateOperation(req: OperationRequest): string | null {
  if (!req.runId)     return 'runId is required';
  if (!req.projectId) return 'projectId is required';
  if (!req.path)      return 'path is required';
  if (req.path.includes('..')) return 'Path traversal is not allowed';
  return null;
}
