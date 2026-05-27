import { npmInstall }    from '../terminal/npm/npm-installer.ts';
import { npmRunScript }  from '../terminal/npm/npm-script-runner.ts';

export interface NpmResult {
  exitCode: number;
  stdout:   string;
  stderr:   string;
}

export const npmManager = {
  async install(
    runId:     string,
    projectId: string,
    packages:  string[] = [],
  ): Promise<NpmResult> {
    const r = await npmInstall(runId, projectId, packages);
    return { exitCode: r.exitCode, stdout: r.stdout, stderr: r.stderr };
  },

  async runScript(
    runId:     string,
    projectId: string,
    script:    string,
    timeoutMs: number = 60_000,
  ): Promise<NpmResult> {
    const r = await npmRunScript(runId, projectId, script, timeoutMs);
    return { exitCode: r.exitCode, stdout: r.stdout, stderr: r.stderr };
  },
};
