import { runToolLoop, type LoopOptions, type LoopResult } from '../llm-loop/tool-loop.ts';
import { apiRouterTemplate, apiTypeTemplate } from '../templates/api-template.ts';
import { toPascalCase, toKebabCase } from '../utils/code-utils.ts';

export interface ApiGeneratorOptions {
  resource: string;
  fields: string[];
  basePath: string;
  useAI?: boolean;
}

export interface GeneratorResult {
  success: boolean;
  files: Record<string, string>;
  summary?: string;
  error?: string;
}

export function generateApiCode(opts: { resource: string; fields: string[] }): string {
  const router = apiRouterTemplate({ resource: opts.resource, fields: opts.fields });
  const types = apiTypeTemplate(opts.resource, opts.fields);
  return [
    `=== routes/${opts.resource}.ts ===`,
    router,
    `=== types/${toPascalCase(opts.resource)}.ts ===`,
    types,
  ].join('\n\n');
}

function templateGenerate(opts: ApiGeneratorOptions): GeneratorResult {
  const { resource, fields } = opts;
  const routePath = `routes/${toKebabCase(resource)}.ts`;
  const typePath = `types/${toPascalCase(resource)}.ts`;

  return {
    success: true,
    files: {
      [routePath]: apiRouterTemplate({ resource, fields }),
      [typePath]: apiTypeTemplate(resource, fields),
    },
    summary: `Generated ${routePath} and ${typePath} for resource "${resource}"`,
  };
}

async function aiGenerate(opts: ApiGeneratorOptions): Promise<GeneratorResult> {
  const fieldList = opts.fields.join(', ');
  const task = [
    `Generate a complete production TypeScript REST API for the "${opts.resource}" resource.`,
    `Fields: ${fieldList}`,
    `Write the following files using write_file:`,
    `  1. routes/${toKebabCase(opts.resource)}.ts — Express router with full CRUD`,
    `  2. types/${toPascalCase(opts.resource)}.ts — TypeScript interfaces`,
    `Use in-memory Map storage. Full type safety. No placeholders.`,
  ].join('\n');

  const loopOpts: LoopOptions = {
    task,
    basePath: opts.basePath,
    extraInstructions: 'Generate exactly 2 files. Call done after both are written.',
    maxIterations: 10,
  };

  const result: LoopResult = await runToolLoop(loopOpts);
  return {
    success: result.success,
    files: {},
    summary: result.summary,
    error: result.error,
  };
}

export async function generateApi(opts: ApiGeneratorOptions): Promise<GeneratorResult> {
  if (opts.useAI) return aiGenerate(opts);
  return templateGenerate(opts);
}
