import { promises as fs } from 'node:fs';
import path from 'node:path';
import { getTool } from './tool-registry.ts';
import { apiRouterTemplate, apiTypeTemplate } from '../templates/api-template.ts';
import { toPascalCase } from '../utils/code-utils.ts';

export interface DispatchResult {
  success: boolean;
  output: string;
  error?: string;
}

export interface DispatchOptions {
  basePath: string;
}

async function writeFile(args: Record<string, unknown>, basePath: string): Promise<DispatchResult> {
  const filePath = String(args.path ?? '');
  const content = String(args.content ?? '');
  if (!filePath) return { success: false, output: '', error: 'path is required' };

  const absolute = path.resolve(basePath, filePath);
  await fs.mkdir(path.dirname(absolute), { recursive: true });
  await fs.writeFile(absolute, content, 'utf-8');
  return { success: true, output: `Wrote ${filePath} (${content.length} chars)` };
}

async function readFile(args: Record<string, unknown>, basePath: string): Promise<DispatchResult> {
  const filePath = String(args.path ?? '');
  if (!filePath) return { success: false, output: '', error: 'path is required' };

  const absolute = path.resolve(basePath, filePath);
  try {
    const content = await fs.readFile(absolute, 'utf-8');
    return { success: true, output: content };
  } catch {
    return { success: false, output: '', error: `File not found: ${filePath}` };
  }
}

async function editFile(args: Record<string, unknown>, basePath: string): Promise<DispatchResult> {
  const filePath = String(args.path ?? '');
  const oldContent = String(args.old_content ?? '');
  const newContent = String(args.new_content ?? '');
  if (!filePath) return { success: false, output: '', error: 'path is required' };
  if (!oldContent) return { success: false, output: '', error: 'old_content is required' };

  const absolute = path.resolve(basePath, filePath);
  let existing: string;
  try {
    existing = await fs.readFile(absolute, 'utf-8');
  } catch {
    return { success: false, output: '', error: `File not found: ${filePath}` };
  }

  if (!existing.includes(oldContent)) {
    return { success: false, output: '', error: 'old_content not found in file — check exact whitespace' };
  }

  const updated = existing.replace(oldContent, newContent);
  await fs.writeFile(absolute, updated, 'utf-8');
  return { success: true, output: `Edited ${filePath}` };
}

function generateApi(args: Record<string, unknown>): DispatchResult {
  const resource = String(args.resource ?? '').trim();
  const rawFields = String(args.fields ?? '').trim();
  if (!resource) return { success: false, output: '', error: 'resource is required' };

  const fields = rawFields.split(',').map(f => f.trim()).filter(Boolean);
  if (fields.length === 0) return { success: false, output: '', error: 'at least one field is required' };

  const router = apiRouterTemplate({ resource, fields });
  const types = apiTypeTemplate(resource, fields);
  const Name = toPascalCase(resource);

  const output = [
    `=== routes/${resource}.ts ===`,
    router,
    `=== types/${Name}.ts ===`,
    types,
  ].join('\n\n');

  return { success: true, output };
}

export async function dispatch(
  toolName: string,
  args: Record<string, unknown>,
  opts: DispatchOptions,
): Promise<DispatchResult> {
  if (!getTool(toolName)) {
    return { success: false, output: '', error: `Unknown tool: "${toolName}"` };
  }

  switch (toolName) {
    case 'write_file':   return writeFile(args, opts.basePath);
    case 'read_file':    return readFile(args, opts.basePath);
    case 'edit_file':    return editFile(args, opts.basePath);
    case 'generate_api': return generateApi(args);
    default:
      return { success: false, output: '', error: `No handler registered for tool: "${toolName}"` };
  }
}
