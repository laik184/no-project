/**
 * server/tools/coding/llm/prompt-builder.ts
 *
 * Builds structured LLM prompts for code generation tasks.
 * Pure function — no side effects, no I/O.
 */

import type { GenerationContext, BuiltPrompt } from './generation-context.ts';

const SYSTEM_PREAMBLE = `You are CodeGen — a precise TypeScript code generation engine.
You produce production-quality TypeScript and React code.
You NEVER generate placeholder code, TODO comments, or stubs.
You respond with a JSON object only — no prose, no markdown outside the JSON.`;

const RESPONSE_FORMAT = `
## Response Format

Respond with exactly this JSON structure:
{
  "files": {
    "path/to/file.ts": "<full file contents>",
    "path/to/other.ts": "<full file contents>"
  },
  "summary": "one-sentence description of what was generated"
}

Rules:
- File contents must be complete, working TypeScript
- Do not truncate or abbreviate any file
- All TypeScript must be strictly typed (no any unless unavoidable)
- No placeholder implementations
- No TODO comments
- No duplicate imports
- No circular imports`;

function frameworkRules(ctx: GenerationContext): string {
  const rules: string[] = [];
  if (ctx.framework === 'react') {
    rules.push(
      'Use functional components only. No class components.',
      'Use named exports. Also export default for pages.',
      'Import React only when using JSX namespace types.',
      'Use Tailwind CSS for styling unless told otherwise.',
    );
  }
  if (ctx.framework === 'express') {
    rules.push(
      'Use Express Router pattern. Export router as default.',
      'All route handlers must be typed with Request, Response, NextFunction.',
      'Use try/catch with next(err) in all async handlers.',
      'Add JSDoc for exported functions.',
    );
  }
  if (ctx.language === 'typescript') {
    rules.push(
      'Strict TypeScript: no implicit any, no non-null assertions unless justified.',
      'Use interface over type alias for object shapes.',
      'Use const assertions where applicable.',
    );
  }
  if (ctx.style === 'tailwind') {
    rules.push(
      'Use Tailwind utility classes. No inline styles.',
      'Use dark: variants for dark mode where it makes sense.',
    );
  }
  if (ctx.extraRules) {
    rules.push(...ctx.extraRules);
  }
  return rules.map(r => `- ${r}`).join('\n');
}

function targetFilesHint(ctx: GenerationContext): string {
  if (!ctx.targetFiles?.length) return '';
  const max = ctx.maxFiles ?? ctx.targetFiles.length;
  return `\n## Expected Output Files (generate exactly ${max})\n${ctx.targetFiles.map(f => `- ${f}`).join('\n')}`;
}

export function buildGenerationPrompt(ctx: GenerationContext): BuiltPrompt {
  const rules = frameworkRules(ctx);
  const fileHint = targetFilesHint(ctx);

  const system = [
    SYSTEM_PREAMBLE,
    RESPONSE_FORMAT,
    rules ? `\n## Language & Framework Rules\n${rules}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  const user = [
    `## Task: ${ctx.toolName}`,
    ctx.task,
    fileHint,
  ]
    .filter(Boolean)
    .join('\n\n');

  return { system, user };
}
