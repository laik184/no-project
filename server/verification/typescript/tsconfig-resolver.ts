import { existsSync, readFileSync } from 'fs';
import { join, dirname } from 'path';

export class TSConfigResolver {
  private cached: Record<string, unknown> | null = null;

  constructor(private workspacePath: string) {}

  resolve(): Record<string, unknown> | null {
    if (this.cached) return this.cached;
    const candidates = [
      join(this.workspacePath, 'tsconfig.json'),
      join(this.workspacePath, 'tsconfig.app.json'),
    ];
    for (const c of candidates) {
      if (existsSync(c)) {
        try {
          this.cached = JSON.parse(readFileSync(c, 'utf8'));
          return this.cached;
        } catch { /* ignore */ }
      }
    }
    return null;
  }

  getCompilerOptions(): Record<string, unknown> {
    return (this.resolve() as any)?.compilerOptions ?? {};
  }

  getBaseUrl(): string {
    return String((this.getCompilerOptions() as any).baseUrl ?? this.workspacePath);
  }
}
