/**
 * tool-dispatcher.ts
 * Routes parsed tool calls to their concrete implementations.
 * All tools go through validation before execution.
 */

import type { ParsedToolCall }    from './response-parser.ts';
import type { ToolResult }        from '../tools/tool-result.ts';
import { ok, err }                from '../tools/tool-result.ts';
import { validateToolInput }      from '../tools/tool-validator.ts';
import { fileWriter }             from '../../filesystem/file-writer.ts';
import { fileReader }             from '../../filesystem/file-reader.ts';
import { fileSearch }             from '../../filesystem/file-search.ts';
import { patchFile }              from '../../filesystem/patch-file.ts';
import { safeDelete }             from '../../filesystem/safe-delete.ts';
import { shellExecutor }          from '../../runtime/shell-executor.ts';
import { npmManager }             from '../../runtime/npm-manager.ts';
import type { WriteFileInput, ReadFileInput, EditFileInput,
              DeleteFileInput, ListDirInput, SearchFilesInput,
              RunCommandInput, NpmInstallInput, RunTestsInput } from '../tools/tool-contracts.ts';

export async function dispatchToolCall(
  call:      ParsedToolCall,
  runId:     string,
  projectId: string,
): Promise<ToolResult> {
  const validation = validateToolInput(call.name, call.args);
  if (!validation.valid) return err(`Validation failed: ${validation.error}`);

  try {
    switch (call.name) {
      case 'write_file': {
        const { path, content } = call.args as WriteFileInput;
        await fileWriter.write(projectId, path, content);
        return ok(`File written: ${path}`, path);
      }

      case 'read_file': {
        const { path } = call.args as ReadFileInput;
        const content  = await fileReader.read(projectId, path);
        return ok(content, path);
      }

      case 'edit_file': {
        const { path, old_string, new_string } = call.args as EditFileInput;
        const result = await patchFile(projectId, path, old_string, new_string);
        if (!result.ok) return err(result.error ?? 'Patch failed', path);
        return ok(`Patched ${result.replacements} occurrence(s) in ${path}`, path);
      }

      case 'delete_file': {
        const { path } = call.args as DeleteFileInput;
        await safeDelete(projectId, path);
        return ok(`Deleted: ${path}`, path);
      }

      case 'list_directory': {
        const { path = '.', recursive = false } = call.args as ListDirInput;
        const files = await fileSearch.listDir(projectId, path, recursive);
        return ok(files.join('\n') || '(empty directory)');
      }

      case 'search_files': {
        const { query, base_dir = '.' } = call.args as SearchFilesInput;
        const matches = await fileSearch.grep(projectId, query, base_dir);
        if (matches.length === 0) return ok('No matches found.');
        const out = matches.slice(0, 30)
          .map((m) => `${m.relativePath}:${m.lineNumber}: ${m.lineContent}`)
          .join('\n');
        return ok(out);
      }

      case 'run_command': {
        const { command } = call.args as RunCommandInput;
        const result = await shellExecutor.executeInSandbox(runId, projectId, command, 30_000);
        const output = [result.stdout, result.stderr].filter(Boolean).join('\n');
        return result.exitCode === 0 ? ok(output || '(exit 0)') : err(output || `Exit ${result.exitCode}`);
      }

      case 'npm_install': {
        const { packages = [], dev = false } = call.args as NpmInstallInput;
        const result = await npmManager.install(runId, projectId, packages, dev);
        const output = [result.stdout, result.stderr].filter(Boolean).join('\n');
        return result.exitCode === 0 ? ok(output || 'npm install complete') : err(output);
      }

      case 'run_tests': {
        const { script = 'test' } = call.args as RunTestsInput;
        const result = await npmManager.runScript(runId, projectId, script, 60_000);
        const output = [result.stdout, result.stderr].filter(Boolean).join('\n');
        return result.exitCode === 0 ? ok(output || 'Tests passed') : err(output || 'Tests failed');
      }

      case 'task_complete':
        return ok((call.args.summary as string) ?? 'Task complete');

      default:
        return err(`Unknown tool: ${call.name}`);
    }
  } catch (e) {
    return err(e instanceof Error ? e.message : String(e));
  }
}
