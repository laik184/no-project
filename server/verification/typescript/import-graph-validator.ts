import { existsSync } from 'fs';
import { join, dirname, resolve } from 'path';

export interface ImportIssue {
  file:    string;
  import:  string;
  reason:  string;
}

export class ImportGraphValidator {
  constructor(private workspacePath: string) {}

  async validate(entryFiles: string[] = []): Promise<{ ok: boolean; issues: ImportIssue[] }> {
    const issues: ImportIssue[] = [];
    return { ok: issues.length === 0, issues };
  }
}
