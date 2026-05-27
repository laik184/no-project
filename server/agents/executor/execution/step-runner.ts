import type { ExecutionStep, StepResult } from '../types/execution.types.ts';
import { elapsedMs }                     from '../utils/execution-helpers.ts';
import { fileWriter }                    from '../../filesystem/file-writer.ts';
import { fileReader }                    from '../../filesystem/file-reader.ts';
import { patchFile }                     from '../../filesystem/patch-file.ts';
import { safeDelete }                    from '../../filesystem/safe-delete.ts';
import { grepLiteral }                   from '../../filesystem/grep-search.ts';
import { readDirectory, formatListing }  from '../../filesystem/directory-reader.ts';
import { withTimeout }                   from '../../../orchestration/utils/execution-utils.ts';
import { runCommand }                    from '../../terminal/execution/command-runner.ts';
import { npmInstall }                    from '../../terminal/npm/npm-installer.ts';
import { npmRunScript }                  from '../../terminal/npm/npm-script-runner.ts';
import { checkpointManager }             from '../../terminal/recovery/checkpoint-manager.ts';
import { validateGeneratedOutput, validateCommandOutput } from '../../terminal/validation/output-validator.ts';
import { getWorkspaceRoot }              from '../../terminal/workspace/runtime-workspace.ts';

function inlineFile(relativePath: string, content: string): { relativePath: string; content: string } {
  return { relativePath, content };
}

function simpleFrontend(name: string) {
  const pascal = name.charAt(0).toUpperCase() + name.slice(1);
  return inlineFile(`src/pages/${pascal}.tsx`, `import React from 'react';\n\nexport default function ${pascal}() {\n  return <div className="p-4"><h1>${pascal}</h1></div>;\n}\n`);
}

function simpleBackend(name: string) {
  const lower = name.toLowerCase();
  return inlineFile(`src/routes/${lower}.ts`, `import { Router } from 'express';\nconst router = Router();\nrouter.get('/', (_req, res) => res.json({ resource: '${lower}' }));\nexport default router;\n`);
}

function simpleApi(name: string) {
  const lower = name.toLowerCase();
  return [
    inlineFile(`src/api/${lower}/route.ts`,   `import { Router } from 'express';\nconst router = Router();\nrouter.get('/',    (_req, res) => res.json([]));\nrouter.post('/',   (req, res)  => res.status(201).json(req.body));\nrouter.put('/:id',(req, res)  => res.json(req.body));\nrouter.delete('/:id',(_req, res) => res.json({ ok: true }));\nexport default router;\n`),
    inlineFile(`src/api/${lower}/types.ts`,   `export interface ${lower.charAt(0).toUpperCase() + lower.slice(1)} { id: string; createdAt: string; }\n`),
  ];
}

function simpleDatabase(name: string) {
  const lower = name.toLowerCase();
  return inlineFile(`src/db/schema/${lower}.ts`, `import { pgTable, text, timestamp } from 'drizzle-orm/pg-core';\nexport const ${lower}s = pgTable('${lower}s', {\n  id: text('id').primaryKey(),\n  createdAt: timestamp('created_at').defaultNow(),\n});\n`);
}

function simpleAuth() {
  return [
    inlineFile('src/auth/middleware.ts', `import type { Request, Response, NextFunction } from 'express';\nexport function requireAuth(req: Request, res: Response, next: NextFunction): void {\n  if (!req.headers.authorization) { res.status(401).json({ error: 'Unauthorized' }); return; }\n  next();\n}\n`),
    inlineFile('src/auth/session.ts',    `export function createSession(userId: string): string { return Buffer.from(userId).toString('base64'); }\nexport function verifySession(token: string): string { return Buffer.from(token, 'base64').toString(); }\n`),
  ];
}

function simpleComponent(name: string) {
  const pascal = name.charAt(0).toUpperCase() + name.slice(1);
  return inlineFile(`src/components/${pascal}.tsx`, `import React from 'react';\ninterface Props { className?: string; }\nexport function ${pascal}({ className }: Props) {\n  return <div className={className}>${pascal}</div>;\n}\n`);
}

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
  const cwd = getWorkspaceRoot(projectId);

  switch (type) {
    case 'generate_frontend': {
      const name = input.name ?? 'Component';
      const file = simpleFrontend(name);
      const check = validateGeneratedOutput(type, file.content);
      if (!check.valid) return { success: false, error: check.errors.join('; ') };
      await fileWriter.write(projectId, file.relativePath, file.content);
      return { success: true, filePath: file.relativePath, output: file.relativePath };
    }

    case 'generate_backend': {
      const name = input.name ?? 'resource';
      const file = simpleBackend(name);
      const check = validateGeneratedOutput(type, file.content);
      if (!check.valid) return { success: false, error: check.errors.join('; ') };
      await fileWriter.write(projectId, file.relativePath, file.content);
      return { success: true, filePath: file.relativePath, output: file.relativePath };
    }

    case 'generate_api': {
      const name  = input.name ?? 'resource';
      const files = simpleApi(name);
      for (const f of files) await fileWriter.write(projectId, f.relativePath, f.content);
      return { success: true, output: files.map((f) => f.relativePath).join(', ') };
    }

    case 'generate_database': {
      const name = input.name ?? 'entity';
      const file = simpleDatabase(name);
      await fileWriter.write(projectId, file.relativePath, file.content);
      return { success: true, filePath: file.relativePath, output: file.relativePath };
    }

    case 'generate_auth': {
      const files = simpleAuth();
      for (const f of files) await fileWriter.write(projectId, f.relativePath, f.content);
      return { success: true, output: files.map((f) => f.relativePath).join(', ') };
    }

    case 'generate_component': {
      const name = input.name ?? 'Component';
      const file = simpleComponent(name);
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

    case 'read_file': {
      if (!input.filePath) return { success: false, error: 'read_file requires filePath' };
      const content = await fileReader.read(projectId, input.filePath);
      return { success: true, output: content, filePath: input.filePath };
    }

    case 'edit_file':
    case 'patch_file': {
      if (!input.filePath)    return { success: false, error: `${type} requires filePath` };
      if (!input.oldString)   return { success: false, error: `${type} requires oldString` };
      if (input.newString === undefined) return { success: false, error: `${type} requires newString` };
      const result = await patchFile(projectId, input.filePath, input.oldString, input.newString);
      if (!result.ok) return { success: false, error: result.error, filePath: input.filePath };
      return { success: true, filePath: input.filePath, output: `Replaced ${result.replacements} occurrence(s)` };
    }

    case 'delete_file': {
      if (!input.filePath) return { success: false, error: 'delete_file requires filePath' };
      const result = await safeDelete(projectId, input.filePath);
      return result.ok
        ? { success: true, output: `Deleted: ${input.filePath}` }
        : { success: false, error: result.error };
    }

    case 'list_directory': {
      const listing = await readDirectory(projectId, input.filePath ?? '.', input.recursive ?? false);
      return { success: true, output: formatListing(listing) };
    }

    case 'search_files': {
      if (!input.query) return { success: false, error: 'search_files requires query' };
      const result = await grepLiteral(projectId, input.query, input.filePath ?? '.');
      if (result.matches.length === 0) return { success: true, output: 'No matches found.' };
      const out = result.matches.slice(0, 30)
        .map((m) => `${m.relativePath}:${m.lineNumber}: ${m.lineContent}`)
        .join('\n');
      return { success: true, output: out };
    }

    case 'npm_install': {
      const args   = input.args ? (input.args as unknown as string[]) : [];
      const result = await npmInstall(runId, projectId, args, { cwd });
      const check  = validateCommandOutput(result.exitCode, result.stdout, result.stderr);
      return { success: check.valid, output: result.stdout.slice(0, 500), error: check.errors[0] };
    }

    case 'npm_run': {
      if (!input.command) return { success: false, error: 'npm_run requires command (script name)' };
      const result = await npmRunScript(runId, projectId, input.command, { cwd, timeoutMs: step.timeoutMs });
      const check  = validateCommandOutput(result.exitCode, result.stdout, result.stderr);
      return { success: check.valid, output: result.stdout.slice(0, 500), error: check.errors[0] };
    }

    case 'run_command': {
      if (!input.command) return { success: false, error: 'run_command requires command' };
      const result = await runCommand({ command: input.command, cwd, timeoutMs: step.timeoutMs });
      const check  = validateCommandOutput(result.exitCode, result.stdout, result.stderr);
      return { success: check.valid, output: result.stdout.slice(0, 500), error: check.errors[0] };
    }

    case 'run_tests': {
      const script = input.command ?? 'test';
      const result = await npmRunScript(runId, projectId, script, { cwd, timeoutMs: step.timeoutMs });
      const out    = [result.stdout, result.stderr].filter(Boolean).join('\n');
      return result.exitCode === 0
        ? { success: true,  output: out.slice(0, 800) }
        : { success: false, error: out.slice(0, 800) };
    }

    case 'validate_output':
      return { success: true, output: `Validated: ${input.description ?? 'step'}` };

    case 'checkpoint': {
      await checkpointManager.create(runId, projectId, step.taskId ?? 'checkpoint');
      return { success: true, output: 'Checkpoint saved' };
    }

    default:
      return { success: false, error: `Unknown step type: ${type}` };
  }
}
