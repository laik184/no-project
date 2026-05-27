import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { getSandboxRoot } from '../validation/sandbox-validator.ts';
import type { ToolDefinition } from '../../registry/tool-types.ts';

export async function writePackageJson(
  projectId: string,
  content:   Record<string, unknown>,
): Promise<void> {
  const dir = getSandboxRoot(projectId);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, 'package.json'), JSON.stringify(content, null, 2), 'utf8');
}

export const writePackageJsonTool: ToolDefinition = {
  name: 'write_package_json', category: 'terminal',
  description: 'Write a package.json to the project sandbox',
  inputSchema: {
    projectId: { type: 'string', description: 'Project ID', required: true },
    content:   { type: 'object', description: 'package.json content', required: true },
  },
  permissions: ['write'], timeoutMs: 5_000,
  retry: { maxAttempts: 1, delayMs: 0, backoff: 'none' },
  handler: async (input: Record<string, unknown>) =>
    writePackageJson(input.projectId as string, input.content as Record<string, unknown>),
};
