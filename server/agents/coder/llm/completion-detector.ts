/**
 * completion-detector.ts
 * Detects when the tool loop should stop.
 */

import type { ParsedToolCall } from './response-parser.ts';

export type StopReason =
  | 'task_complete'
  | 'max_iterations'
  | 'repeated_tool_call'
  | 'no_tool_calls'
  | 'llm_stop'
  | 'error';

export interface CompletionSignal {
  done:   boolean;
  reason: StopReason;
  summary?: string;
}

const NOT_DONE: CompletionSignal = { done: false, reason: 'task_complete' };

export function checkCompletion(
  toolCalls:       ParsedToolCall[],
  finishReason:    string,
  iterationCount:  number,
  maxIterations:   number,
  callHistory:     ParsedToolCall[],
): CompletionSignal {
  // Hard limit
  if (iterationCount >= maxIterations) {
    return { done: true, reason: 'max_iterations' };
  }

  // LLM said stop with no tool calls
  if (finishReason === 'stop' && toolCalls.length === 0) {
    return { done: true, reason: 'llm_stop' };
  }

  // No tool calls at all
  if (toolCalls.length === 0) {
    return { done: true, reason: 'no_tool_calls' };
  }

  // task_complete signal
  const completionCall = toolCalls.find((tc) => tc.name === 'task_complete');
  if (completionCall) {
    return {
      done:    true,
      reason:  'task_complete',
      summary: (completionCall.args.summary as string) ?? 'Task completed',
    };
  }

  // Detect repeated identical call (infinite loop guard)
  if (isRepeatedCall(toolCalls, callHistory)) {
    return { done: true, reason: 'repeated_tool_call' };
  }

  return NOT_DONE;
}

function isRepeatedCall(
  current: ParsedToolCall[],
  history: ParsedToolCall[],
): boolean {
  if (history.length < 2) return false;

  // Check last 3 calls in history for identical tool+args
  const recent = history.slice(-3);
  for (const curr of current) {
    const currKey = callKey(curr);
    const matches = recent.filter((h) => callKey(h) === currKey).length;
    if (matches >= 2) return true;
  }
  return false;
}

function callKey(tc: ParsedToolCall): string {
  return `${tc.name}:${JSON.stringify(tc.args)}`;
}
