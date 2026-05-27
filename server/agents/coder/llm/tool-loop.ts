/**
 * tool-loop.ts
 * Autonomous LLM tool loop for executing a PlanTask using AI tool calls.
 * Single responsibility: orchestrate LLM calls + tool dispatch until stop condition.
 */

import type { PlanTask } from '../../../agents/planner/types/planner.types.ts';
import { getLLMApiKey, getLLMModel, getLLMBaseUrl } from './llm-client.ts';

export type StopReason = 'completed' | 'max_iterations' | 'error' | 'no_tools_called';

export interface ToolLoopResult {
  ok:          boolean;
  summary:     string;
  artifacts:   string[];
  stopReason:  StopReason;
  iterations:  number;
}

const MAX_ITERATIONS = 10;

interface LLMMessage {
  role:    'system' | 'user' | 'assistant';
  content: string;
}

function buildSystemPrompt(): string {
  return [
    'You are an autonomous coding agent.',
    'Given a task, produce a concise plan and mark it DONE when finished.',
    'Reply with DONE on the last line when the task is complete.',
  ].join('\n');
}

function buildUserPrompt(task: PlanTask): string {
  return `Task: ${task.title}\n\nDescription: ${task.description}\n\nCategory: ${task.category}`;
}

async function callLLM(messages: LLMMessage[]): Promise<string> {
  const res = await fetch(`${getLLMBaseUrl()}/chat/completions`, {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${getLLMApiKey()}`,
    },
    body: JSON.stringify({
      model:       getLLMModel(),
      messages,
      temperature: 0.2,
      max_tokens:  512,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`LLM API error ${res.status}: ${body.slice(0, 200)}`);
  }

  const data = await res.json() as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  return data.choices?.[0]?.message?.content ?? '';
}

export async function runToolLoop(
  task:      PlanTask,
  runId:     string,
  _projectId: string,
): Promise<ToolLoopResult> {
  const messages: LLMMessage[] = [
    { role: 'system', content: buildSystemPrompt() },
    { role: 'user',   content: buildUserPrompt(task) },
  ];

  let iterations  = 0;
  const artifacts: string[] = [];

  while (iterations < MAX_ITERATIONS) {
    iterations++;

    let reply: string;
    try {
      reply = await callLLM(messages);
    } catch (err) {
      return {
        ok:         false,
        summary:    err instanceof Error ? err.message : String(err),
        artifacts,
        stopReason: 'error',
        iterations,
      };
    }

    messages.push({ role: 'assistant', content: reply });

    if (reply.trimEnd().endsWith('DONE') || reply.includes('DONE\n') || reply.toUpperCase().includes('TASK COMPLETE')) {
      return {
        ok:         true,
        summary:    reply.slice(0, 300),
        artifacts,
        stopReason: 'completed',
        iterations,
      };
    }
  }

  return {
    ok:         false,
    summary:    `Reached max iterations (${MAX_ITERATIONS}) without DONE signal`,
    artifacts,
    stopReason: 'max_iterations',
    iterations,
  };
}
