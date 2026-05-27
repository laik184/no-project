import { runToolLoop, type LoopOptions, type LoopResult } from '../llm-loop/tool-loop.ts';
import { reactComponentTemplate, reactPageTemplate } from '../templates/react-template.ts';
import { toKebabCase, toPascalCase, fileHeader } from '../utils/code-utils.ts';

export interface ComponentSpec {
  name: string;
  props?: string;
  children?: string;
}

export interface PageSpec {
  name: string;
  content?: string;
}

export interface FrontendGeneratorOptions {
  task: string;
  basePath: string;
  components?: ComponentSpec[];
  pages?: PageSpec[];
  useAI?: boolean;
}

export interface GeneratorResult {
  success: boolean;
  files: Record<string, string>;
  summary?: string;
  error?: string;
}

function appEntryTemplate(pages: PageSpec[]): string {
  const imports = pages
    .map(p => `import { ${toPascalCase(p.name)}Page } from './pages/${toKebabCase(p.name)}.tsx';`)
    .join('\n');

  const routes = pages
    .map(p => `    <Route path="/${toKebabCase(p.name)}" component={${toPascalCase(p.name)}Page} />`)
    .join('\n');

  return `import { Switch, Route } from 'wouter';
${imports}

export default function App(): JSX.Element {
  return (
    <Switch>
${routes}
      <Route>404 Not Found</Route>
    </Switch>
  );
}
`;
}

function templateGenerate(opts: FrontendGeneratorOptions): GeneratorResult {
  const files: Record<string, string> = {};

  for (const comp of opts.components ?? []) {
    const filename = `src/components/${toKebabCase(comp.name)}.tsx`;
    files[filename] =
      fileHeader(filename, `${toPascalCase(comp.name)} component`) +
      reactComponentTemplate({
        componentName: comp.name,
        hasProps: !!comp.props,
        propsInterface: comp.props,
        children: comp.children,
      });
  }

  for (const page of opts.pages ?? []) {
    const filename = `src/pages/${toKebabCase(page.name)}.tsx`;
    files[filename] =
      fileHeader(filename, `${toPascalCase(page.name)} page`) +
      reactPageTemplate(page.name, page.content);
  }

  if (opts.pages && opts.pages.length > 0) {
    files['src/App.tsx'] = appEntryTemplate(opts.pages);
  }

  return {
    success: true,
    files,
    summary: `Generated ${Object.keys(files).length} frontend file(s)`,
  };
}

async function aiGenerate(opts: FrontendGeneratorOptions): Promise<GeneratorResult> {
  const loopOpts: LoopOptions = {
    task: opts.task,
    basePath: opts.basePath,
    extraInstructions: [
      'Generate React components in src/components/ and pages in src/pages/.',
      'Use TypeScript (.tsx). Export named exports. No default class components.',
      'Call done when all files are written.',
    ].join('\n'),
    maxIterations: 15,
  };

  const result: LoopResult = await runToolLoop(loopOpts);
  return { success: result.success, files: {}, summary: result.summary, error: result.error };
}

export async function generateFrontend(opts: FrontendGeneratorOptions): Promise<GeneratorResult> {
  if (opts.useAI) return aiGenerate(opts);
  return templateGenerate(opts);
}
