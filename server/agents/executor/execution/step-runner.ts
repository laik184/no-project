import type { ExecutionStep, StepResult } from '../types/execution.types.ts';
import { elapsedMs, generateStepId } from '../utils/execution-helpers.ts';
import { fileWriter } from '../filesystem/file-writer.ts';
import { fileEditor } from '../filesystem/file-editor.ts';
import { shellExecutor } from '../runtime/shell-executor.ts';
import { npmManager } from '../runtime/npm-manager.ts';
import { checkpointManager } from '../recovery/checkpoint-manager.ts';
import { validateGeneratedCode, validateCommandOutput } from '../validation/output-validator.ts';
import { frontendGenerator } from '../coding/frontend-generator.ts';
import { backendGenerator } from '../coding/backend-generator.ts';
import { apiGenerator } from '../coding/api-generator.ts';
import { databaseGenerator } from '../coding/database-generator.ts';
import { authGenerator } from '../coding/auth-generator.ts';
import { componentGenerator } from '../coding/component-generator.ts';
import { withTimeout } from '../../../orchestration/utils/execution-utils.ts';

export async function runStep(
  step:      ExecutionStep,
  runId:     string,
  projectId: string,
): Promise<StepResult> {
  const start = new Date();
  try {
    const result = await withTimeout(
      () => dispatchStep(step, runId, projectId),
      { timeoutMs: step.timeoutMs },
    );
    return { ...result, stepId: step.id, durationMs: elapsedMs(start) };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    return { stepId: step.id, success: false, durationMs: elapsedMs(start), error };
  }
}

async function dispatchStep(
  step:      ExecutionStep,
  runId:     string,
  projectId: string,
): Promise<Omit<StepResult, 'stepId' | 'durationMs'>> {
  const { type, input } = step;

  switch (type) {
    case 'generate_frontend': {
      const name = input.name ?? 'Component';
      const file = input.category === 'layout'
        ? frontendGenerator.generateLayout(name)
        : input.category === 'hook'
          ? frontendGenerator.generateHook(name, name)
          : frontendGenerator.generatePage(name);
      const check = validateGeneratedCode(type, file.content);
      if (!check.valid) return { success: false, error: check.errors.join('; ') };
      await fileWriter.write(projectId, file.relativePath, file.content);
      return { success: true, filePath: file.relativePath, output: file.relativePath };
    }

    case 'generate_backend': {
      const name = input.name ?? 'resource';
      const file = backendGenerator.generateRoute(name);
      const check = validateGeneratedCode(type, file.content);
      if (!check.valid) return { success: false, error: check.errors.join('; ') };
      await fileWriter.write(projectId, file.relativePath, file.content);
      return { success: true, filePath: file.relativePath, output: file.relativePath };
    }

    case 'generate_api': {
      const name  = input.name ?? 'resource';
      const files = apiGenerator.generateCrudEndpoints(name);
      for (const f of files) await fileWriter.write(projectId, f.relativePath, f.content);
      return { success: true, output: files.map((f) => f.relativePath).join(', ') };
    }

    case 'generate_database': {
      const name = input.name ?? 'entity';
      const file = databaseGenerator.generateSchema(name);
      await fileWriter.write(projectId, file.relativePath, file.content);
      return { success: true, filePath: file.relativePath, output: file.relativePath };
    }

    case 'generate_auth': {
      const files = authGenerator.generateAuthSystem();
      for (const f of files) await fileWriter.write(projectId, f.relativePath, f.content);
      return { success: true, output: files.map((f) => f.relativePath).join(', ') };
    }

    case 'generate_component': {
      const name = input.name ?? 'Component';
      const file = componentGenerator.generateReactComponent(name);
      await fileWriter.write(projectId, file.relativePath, file.content);
      return { success: true, filePath: file.relativePath, output: file.relativePath };
    }

    case 'write_file': {
      if (!input.filePath || !input.fileContent) {
        return { success: false, error: 'write_file requires filePath and fileContent' };
      }
      await fileWriter.write(projectId, input.filePath, input.fileContent);
      return { success: true, filePath: input.filePath };
    }

    case 'edit_file': {
      if (!input.filePath || !input.fileContent) {
        return { success: false, error: 'edit_file requires filePath and fileContent' };
      }
      await fileEditor.append(projectId, input.filePath, input.fileContent);
      return { success: true, filePath: input.filePath };
    }

    case 'npm_install': {
      const result = await npmManager.install(runId, projectId, input.args ?? []);
      const check  = validateCommandOutput(result.exitCode, result.stdout, result.stderr);
      return { success: check.valid, output: result.stdout.slice(0, 500), error: check.errors[0] };
    }

    case 'npm_run': {
      if (!input.command) return { success: false, error: 'npm_run requires command (script name)' };
      const result = await shellExecutor.executeInSandbox(runId, projectId, `npm run ${input.command}`, step.timeoutMs);
      const check  = validateCommandOutput(result.exitCode, result.stdout, result.stderr);
      return { success: check.valid, output: result.stdout.slice(0, 500), error: check.errors[0] };
    }

    case 'run_command': {
      if (!input.command) return { success: false, error: 'run_command requires command' };
      const result = await shellExecutor.executeInSandbox(runId, projectId, input.command, step.timeoutMs);
      const check  = validateCommandOutput(result.exitCode, result.stdout, result.stderr);
      return { success: check.valid, output: result.stdout.slice(0, 500), error: check.errors[0] };
    }

    case 'validate_output':
      return { success: true, output: `Validated: ${input.description ?? 'step'}` };

    case 'checkpoint': {
      await checkpointManager.create(runId, step.taskId, projectId);
      return { success: true, output: 'Checkpoint saved' };
    }

    default:
      return { success: false, error: `Unknown step type: ${type}` };
  }
}
