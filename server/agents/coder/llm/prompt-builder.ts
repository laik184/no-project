/**
 * prompt-builder.ts
 * Builds the system prompt and initial user message for the tool loop.
 */

import type { PlanTask } from '../../executor/types/executor.types.ts';
import type { ToolObservation } from './tool-observation.ts';

export interface PromptContext {
  task:          PlanTask;
  projectFiles:  string[];        // relative paths
  existingCode?: Record<string, string>;  // path → content snippets
  failureHistory?: string[];      // previous error messages this run
}

const SYSTEM_PROMPT = `You are an autonomous coding execution agent. Your job is to implement a specific development task by using the tools available to you.

RULES:
1. Read existing files before editing them to understand context.
2. Use edit_file with exact old_string/new_string for surgical changes; use write_file only for new files or full rewrites.
3. Run commands only when necessary (npm install, tests).
4. Call task_complete when the task is fully done.
5. Never hallucinate file contents — read first, then edit.
6. Keep changes minimal and focused on the task.
7. If a command fails, read the error, fix the root cause, try again.
8. Do NOT call the same tool with the same args twice in a row.

SANDBOX: All file paths are relative to the project root. No absolute paths. No path traversal.`;

export function buildSystemPrompt(): string {
  return SYSTEM_PROMPT;
}

export function buildTaskMessage(ctx: PromptContext): string {
  const lines: string[] = [
    `# Task: ${ctx.task.title}`,
    `Category: ${ctx.task.category}`,
    `Priority: ${ctx.task.priority}`,
    '',
    `## Description`,
    ctx.task.description,
  ];

  if (ctx.task.dependencies?.length) {
    lines.push('', `## Dependencies`, ctx.task.dependencies.join(', '));
  }

  if (ctx.projectFiles.length > 0) {
    lines.push('', `## Current project files (${ctx.projectFiles.length} total)`);
    lines.push(ctx.projectFiles.slice(0, 60).join('\n'));
    if (ctx.projectFiles.length > 60) lines.push(`…and ${ctx.projectFiles.length - 60} more`);
  }

  if (ctx.existingCode && Object.keys(ctx.existingCode).length > 0) {
    lines.push('', '## Relevant existing code');
    for (const [path, snippet] of Object.entries(ctx.existingCode)) {
      lines.push(`\n### ${path}\n\`\`\`\n${snippet.slice(0, 600)}\n\`\`\``);
    }
  }

  if (ctx.failureHistory?.length) {
    lines.push('', '## Previous failures to avoid');
    ctx.failureHistory.forEach((e) => lines.push(`- ${e}`));
  }

  lines.push('', 'Begin executing the task now. Call task_complete when done.');

  return lines.join('\n');
}

export function buildObservationMessage(obs: ToolObservation): string {
  const icon = obs.status === 'ok' ? '✓' : '✗';
  return `${icon} [${obs.toolName}] ${obs.summary}`;
}
