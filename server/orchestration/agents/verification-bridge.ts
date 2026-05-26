import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface VerificationCheck {
  name: string;
  passed: boolean;
  output: string;
  durationMs: number;
  error?: string;
}

export interface VerificationResult {
  passed: boolean;
  checks: VerificationCheck[];
  summary: string;
  durationMs: number;
}

async function runShellCheck(name: string, cmd: string, cwd: string, timeoutMs = 60_000): Promise<VerificationCheck> {
  const start = Date.now();
  try {
    const { stdout, stderr } = await execAsync(cmd, { cwd, timeout: timeoutMs });
    return { name, passed: true, output: (stdout + stderr).trim().slice(0, 3000), durationMs: Date.now() - start };
  } catch (err) {
    const output = err instanceof Error ? err.message.slice(0, 3000) : String(err);
    return { name, passed: false, output, durationMs: Date.now() - start, error: `Check "${name}" failed` };
  }
}

export const verificationBridge = {
  async verify(projectRoot: string, checks: string[] = ['typescript', 'build']): Promise<VerificationResult> {
    const start = Date.now();
    const results: VerificationCheck[] = [];

    if (checks.includes('typescript')) {
      results.push(await runShellCheck('typescript', 'npx tsc --noEmit --skipLibCheck 2>&1 | head -50', projectRoot));
    }

    if (checks.includes('build')) {
      results.push(await runShellCheck('build', 'npm run build 2>&1 | tail -30', projectRoot));
    }

    const passed = results.every((r) => r.passed);
    const failures = results.filter((r) => !r.passed).map((r) => r.name);

    return {
      passed,
      checks: results,
      summary: passed ? 'All checks passed' : `Failed: ${failures.join(', ')}`,
      durationMs: Date.now() - start,
    };
  },

  async verifyTypeScript(projectRoot: string): Promise<VerificationCheck> {
    return runShellCheck('typescript', 'npx tsc --noEmit --skipLibCheck 2>&1 | head -50', projectRoot);
  },

  async verifyBuild(projectRoot: string): Promise<VerificationCheck> {
    return runShellCheck('build', 'npm run build 2>&1 | tail -30', projectRoot);
  },
};
