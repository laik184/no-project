import { existsSync } from 'fs';
import { join }       from 'path';

export class DependencyIntegrityVerifier {
  constructor(private workspacePath: string) {}

  async verify(): Promise<{ ok: boolean; missing: string[]; error?: string }> {
    const missing: string[] = [];
    try {
      const pkgPath = join(this.workspacePath, 'package.json');
      if (!existsSync(pkgPath)) return { ok: false, missing: ['package.json'] };

      const nmPath = join(this.workspacePath, 'node_modules');
      if (!existsSync(nmPath)) missing.push('node_modules');

      return { ok: missing.length === 0, missing };
    } catch (err) {
      return { ok: false, missing, error: String(err) };
    }
  }
}
