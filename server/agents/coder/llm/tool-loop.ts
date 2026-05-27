/**
 * tool-loop.ts
 * Dynamic LLM tool-calling execution loop.
 * Replaces static task-interpreter → step-runner pipeline for complex tasks.
 */

import type OpenAI from 'openai';
import { getLLMClient, getLLMModel, isLLMAvailable } from './llm-client.ts';
import { EXECUTOR_TOOLS }       from '../tools/tool-schema.ts';
import { parseResponse, buildAssistantMessage, buildToolResultMessage } from './response-parser.ts';
import { dispatchToolCall }     from './tool-dispatcher.ts';
import { checkCompletion }      from './completion-detector.ts';
import { buildToolContext }     from './tool-context.ts';
import { buildSystemPrompt, buildTaskMessage, buildObservationMessage } from './prompt-builder.ts';
import { buildObservation, observationStore } from './tool-observation.ts';
import { summarise }            from '../tools/tool-result.ts';
import { executorLogger }       from '../../executor/telemetry/executor-logger.ts';
import type { PlanTask }        from '../../executor/types/executor.types.ts';
import type { ParsedToolCall }  from './response-parser.ts';
import type { StopReason }      from './completion-detector.ts';
import { failureMemory }        from '../memory/failure-memory.ts';


const MAX_ITERATIONS = 30;

export interface ToolLoopResult {
  ok:         boolean;
  summary:    string;
  stopReason: StopReason;
  iterations: number;
  artifacts:  string[];
}

export async function runToolLoop(
  task:      PlanTask,
  runId:     string,
  projectId: string,
): Promise<ToolLoopResult> {
  if (!isLLMAvailable()) {
    return { ok: false, summary: 'No LLM key available', stopReason: 'error', iterations: 0, artifacts: [] };
  }

  const client = getLLMClient();
  const model  = getLLMModel();
  const ctx    = await buildToolContext(projectId, task);

  const failHistory = failureMemory.getRecent(runId, 3).map((f) => f.error);
  const taskMsg     = buildTaskMessage({ task, ...ctx, failureHistory: failHistory });

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: 'system',  content: buildSystemPrompt() },
    { role: 'user',    content: taskMsg },
  ];

  const callHistory: ParsedToolCall[] = [];
  const artifacts:   string[]         = [];
  let   iteration = 0;
  let   stopReason: StopReason = 'task_complete';

  executorLogger.info(runId, `[tool-loop] Starting — task: ${task.id} (${task.title})`);

  while (iteration < MAX_ITERATIONS) {
    iteration++;

    let completion: Awaited<ReturnType<typeof client.chat.completions.create>>;
    try {
      completion = await client.chat.completions.create({
        model,
        messages,
        tools:       EXECUTOR_TOOLS,
        tool_choice: 'auto',
        temperature: 0.1,
        max_tokens:  4096,
      });
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      executorLogger.error(runId, `[tool-loop] LLM call failed: ${error}`);
      failureMemory.record(runId, task.id, error);
      return { ok: false, summary: error, stopReason: 'error', iterations: iteration, artifacts };
    }

    const choice   = completion.choices[0];
    const parsed   = parseResponse(choice);
    const signal   = checkCompletion(parsed.toolCalls, parsed.finishReason, iteration, MAX_ITERATIONS, callHistory);

    // Append assistant turn to history
    messages.push(buildAssistantMessage(choice));

    if (signal.done) {
      stopReason = signal.reason;
      const summary = signal.summary ?? (parsed.textContent || 'Done');
      executorLogger.info(runId, `[tool-loop] Stop: ${stopReason} after ${iteration} iter`);
      observationStore.clear(runId);
      return { ok: stopReason === 'task_complete', summary, stopReason, iterations: iteration, artifacts };
    }

    // Execute each tool call and feed results back
    for (const call of parsed.toolCalls) {
      if (call.name === 'task_complete') continue;

      const t0     = Date.now();
      const result = await dispatchToolCall(call, runId, projectId);
      const dur    = Date.now() - t0;

      const obs = buildObservation(runId, iteration, call.name, call.args,
                                   result.status, summarise(result), dur);

      callHistory.push(call);
      if (result.filePath) artifacts.push(result.filePath);

      if (result.status === 'error') {
        failureMemory.record(runId, task.id, result.error ?? result.output);
      }

      executorLogger.info(runId, buildObservationMessage(obs), { durationMs: dur });

      // Feed tool result back to LLM
      messages.push(buildToolResultMessage(call.id, summarise(result, 1200)));
    }
  }

  observationStore.clear(runId);
  return { ok: false, summary: 'Max iterations reached', stopReason: 'max_iterations', iterations: iteration, artifacts };
}
