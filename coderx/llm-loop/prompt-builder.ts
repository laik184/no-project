import { getAllTools, type ToolMeta } from './tool-registry.ts';

export interface PromptContext {
  task: string;
  projectFiles?: Record<string, string>;
  extraInstructions?: string;
  iteration?: number;
  observations?: string[];
}

export interface BuiltPrompt {
  system: string;
  user: string;
}

function renderTool(t: ToolMeta): string {
  const params = Object.entries(t.parameters)
    .map(([k, v]) => `    - ${k} (${v.type}${v.required ? ', required' : ''}): ${v.description}`)
    .join('\n');
  return `### ${t.name}\n  ${t.description}\n  Parameters:\n${params}`;
}

function renderFiles(files: Record<string, string>): string {
  return Object.entries(files)
    .map(([p, c]) => `<file path="${p}">\n${c}\n</file>`)
    .join('\n');
}

function renderObservations(obs: string[]): string {
  return obs
    .map((o, i) => `[Step ${i + 1}] ${o}`)
    .join('\n');
}

export function buildPrompt(ctx: PromptContext): BuiltPrompt {
  const tools = getAllTools().map(renderTool).join('\n\n');

  const system = [
    'You are CoderX — a precise, autonomous coding assistant.',
    'You generate production-quality TypeScript, React, and Node.js code.',
    'You work by calling one tool per turn until the task is fully complete.',
    '',
    '## Available Tools',
    tools,
    '',
    '## Response Format',
    'Always respond with a valid JSON object — no extra text.',
    '',
    'While working:',
    '```json',
    '{',
    '  "thought": "your reasoning for this step",',
    '  "tool_call": {',
    '    "name": "tool_name",',
    '    "arguments": { "key": "value" }',
    '  }',
    '}',
    '```',
    '',
    'When the task is fully complete:',
    '```json',
    '{',
    '  "thought": "all steps done",',
    '  "done": true,',
    '  "summary": "what was built"',
    '}',
    '```',
    '',
    '## Rules',
    '- One tool call per response, no exceptions',
    '- Write complete working code — no stubs, no placeholders',
    '- All TypeScript must be strictly typed',
    '- Do not repeat a tool call with identical arguments',
    ctx.extraInstructions ?? '',
  ]
    .filter(Boolean)
    .join('\n');

  const parts: string[] = [`## Task\n${ctx.task}`];

  if (ctx.projectFiles && Object.keys(ctx.projectFiles).length > 0) {
    parts.push(`## Project Files\n${renderFiles(ctx.projectFiles)}`);
  }

  if (ctx.observations && ctx.observations.length > 0) {
    parts.push(`## Previous Steps\n${renderObservations(ctx.observations)}`);
  }

  if (ctx.iteration !== undefined) {
    parts.push(`## Current Iteration: ${ctx.iteration}`);
  }

  return { system, user: parts.join('\n\n') };
}
