import type { ExecutionStep, StepResult }            from './types.ts';
import { elapsedMs }                                from './utils.ts';
import { writeFile }                                from '../../tools/filesystem/lib/files/file-writer.ts';
import { readFile }                                 from '../../tools/filesystem/lib/files/file-reader.ts';
import { patchFile as patchFileOp }                 from '../../tools/filesystem/lib/files/patch-file.ts';
import { deleteFileFromSandbox }                    from '../../tools/filesystem/lib/files/file-deleter.ts';
import { searchText }                               from '../../tools/filesystem/lib/search/text-search.ts';
import { readFolder }                               from '../../tools/filesystem/lib/folders/folder-reader.ts';
import { withTimeout }                              from '../../orchestration/utils/execution-utils.ts';
import { runCommand }                               from '../terminal/execution/command-runner.ts';
import { npmInstall }                               from '../terminal/npm/npm-installer.ts';
import { npmRunScript }                             from '../terminal/npm/npm-script-runner.ts';
import { checkpointManager }                        from '../terminal/recovery/checkpoint-manager.ts';
import { validateGeneratedOutput, validateCommandOutput } from '../terminal/validation/output-validator.ts';
import { getWorkspaceRoot }                         from '../terminal/workspace/runtime-workspace.ts';

function inlineFile(relativePath: string, content: string) {
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
    inlineFile(`src/api/${lower}/route.ts`, `import { Router } from 'express';\nconst router = Router();\nrouter.get('/',     (_req, res) => res.json([]));\nrouter.post('/',    (req, res)  => res.status(201).json(req.body));\nrouter.put('/:id',  (req, res)  => res.json(req.body));\nrouter.delete('/:id',(_req, res) => res.json({ ok: true }));\nexport default router;\n`),
    inlineFile(`src/api/${lower}/types.ts`, `export interface ${lower.charAt(0).toUpperCase() + lower.slice(1)} { id: string; createdAt: string; }\n`),
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

export async function runStep(step: ExecutionStep, runId: string, projectId: string): Promise<StepResult> {
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
  step: ExecutionStep,
  runId: string,
  projectId: string,
): Promise<Omit<StepResult, 'stepId' | 'durationMs'>> {
  const { type, input } = step;
  const cwd = getWorkspaceRoot(projectId);

  const fsWrite = (path: string, content: string) =>
    writeFile({ sandboxRoot: cwd, path, content });
  const fsRead = (path: string) =>
    readFile({ sandboxRoot: cwd, path });

  switch (type) {
    case 'generate_frontend': {
      const name = input.name ?? 'Component';
      const file = simpleFrontend(name);
      const check = validateGeneratedOutput(type, file.content);
      if (!check.valid) return { success: false, error: check.errors.join('; ') };
      await fsWrite(file.relativePath, file.content);
      return { success: true, filePath: file.relativePath, output: file.relativePath };
    }
    case 'generate_backend': {
      const name = input.name ?? 'resource';
      const file = simpleBackend(name);
      const check = validateGeneratedOutput(type, file.content);
      if (!check.valid) return { success: false, error: check.errors.join('; ') };
      await fsWrite(file.relativePath, file.content);
      return { success: true, filePath: file.relativePath, output: file.relativePath };
    }
    case 'generate_api': {
      const files = simpleApi(input.name ?? 'resource');
      for (const f of files) await fsWrite(f.relativePath, f.content);
      return { success: true, output: files.map((f) => f.relativePath).join(', ') };
    }
    case 'generate_database': {
      const file = simpleDatabase(input.name ?? 'entity');
      await fsWrite(file.relativePath, file.content);
      return { success: true, filePath: file.relativePath, output: file.relativePath };
    }
    case 'generate_auth': {
      const files = simpleAuth();
      for (const f of files) await fsWrite(f.relativePath, f.content);
      return { success: true, output: files.map((f) => f.relativePath).join(', ') };
    }
    case 'generate_component': {
      const file = simpleComponent(input.name ?? 'Component');
      await fsWrite(file.relativePath, file.content);
      return { success: true, filePath: file.relativePath, output: file.relativePath };
    }
    case 'write_file': {
      if (!input.filePath || !input.fileContent) return { success: false, error: 'write_file requires filePath and fileContent' };
      await fsWrite(input.filePath, input.fileContent);
      return { success: true, filePath: input.filePath };
    }
    case 'read_file': {
      if (!input.filePath) return { success: false, error: 'read_file requires filePath' };
      const content = await fsRead(input.filePath);
      return { success: true, output: content, filePath: input.filePath };
    }
    case 'edit_file':
    case 'patch_file': {
      if (!input.filePath)               return { success: false, error: `${type} requires filePath` };
      if (!input.oldString)              return { success: false, error: `${type} requires oldString` };
      if (input.newString === undefined) return { success: false, error: `${type} requires newString` };
      const result = await patchFileOp({ sandboxRoot: cwd, path: input.filePath, oldString: input.oldString, newString: input.newString });
      return { success: true, filePath: input.filePath, output: `Replaced ${result.occurrences} occurrence(s)` };
    }
    case 'delete_file': {
      if (!input.filePath) return { success: false, error: 'delete_file requires filePath' };
      const result = await deleteFileFromSandbox({ sandboxRoot: cwd, path: input.filePath });
      return result.deleted
        ? { success: true, output: `Deleted: ${input.filePath}` }
        : { success: false, error: `File not found or could not be deleted: ${input.filePath}` };
    }
    case 'list_directory': {
      const entries = await readFolder({ sandboxRoot: cwd, path: input.filePath ?? '.' });
      const listing = entries.map((e) => `${e.isDirectory ? 'd' : 'f'} ${e.relativePath}`).join('\n');
      return { success: true, output: listing || '(empty directory)' };
    }
    case 'search_files': {
      if (!input.query) return { success: false, error: 'search_files requires query' };
      const results = await searchText({ sandboxRoot: cwd, path: input.filePath ?? '.', query: input.query });
      const matches = results.flatMap((r) => r.matches.map((m) => `${r.relativePath}:${m.lineNumber}: ${m.lineContent}`));
      if (matches.length === 0) return { success: true, output: 'No matches found.' };
      return { success: true, output: matches.slice(0, 30).join('\n') };
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
      const result = await npmRunScript(runId, projectId, input.command ?? 'test', { cwd, timeoutMs: step.timeoutMs });
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
