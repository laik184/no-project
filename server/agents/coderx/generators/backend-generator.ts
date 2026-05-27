import { runToolLoop, type LoopOptions, type LoopResult } from '../llm-loop/tool-loop.ts';
import { expressServerTemplate, expressRouterTemplate } from '../templates/express-template.ts';
import { toKebabCase, toCamelCase, fileHeader } from '../utils/code-utils.ts';

export interface RouteSpec {
  name: string;
  prefix: string;
  middlewares?: string[];
}

export interface BackendGeneratorOptions {
  task: string;
  basePath: string;
  port?: number;
  routes?: RouteSpec[];
  useAI?: boolean;
}

export interface GeneratorResult {
  success: boolean;
  files: Record<string, string>;
  summary?: string;
  error?: string;
}

function templateGenerate(opts: BackendGeneratorOptions): GeneratorResult {
  const files: Record<string, string> = {};
  const routes = opts.routes ?? [];
  const port = opts.port ?? 3000;

  for (const route of routes) {
    const filename = `routes/${toKebabCase(route.name)}.ts`;
    files[filename] =
      fileHeader(filename, `${route.name} router`) +
      expressRouterTemplate({ prefix: route.prefix, middlewares: route.middlewares });
  }

  const routeMeta = routes.map(r => ({
    prefix: r.prefix,
    module: toKebabCase(r.name),
  }));

  files['server.ts'] =
    fileHeader('server.ts', 'Express server entry point') +
    expressServerTemplate(port, routeMeta);

  return {
    success: true,
    files,
    summary: `Generated server.ts + ${routes.length} route file(s) on port ${port}`,
  };
}

async function aiGenerate(opts: BackendGeneratorOptions): Promise<GeneratorResult> {
  const port = opts.port ?? 3000;
  const loopOpts: LoopOptions = {
    task: opts.task,
    basePath: opts.basePath,
    extraInstructions: [
      `Use Express on port ${port}.`,
      'Write server.ts as entry point. Place routes in routes/ directory.',
      'Use TypeScript strictly. Export the express app from server.ts.',
      'Add a /health endpoint. Add a global error handler as last middleware.',
      'Call done when all files are written.',
    ].join('\n'),
    maxIterations: 15,
  };

  const result: LoopResult = await runToolLoop(loopOpts);
  return { success: result.success, files: {}, summary: result.summary, error: result.error };
}

export async function generateBackend(opts: BackendGeneratorOptions): Promise<GeneratorResult> {
  if (opts.useAI) return aiGenerate(opts);
  return templateGenerate(opts);
}
