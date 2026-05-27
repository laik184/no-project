/**
 * output-streamer.ts
 * Bridges streaming process output to the executor event bus and SSE.
 */

import { executorBus }    from '../executor/events/executor-events.ts';
import { executorLogger } from '../executor/telemetry/executor-logger.ts';
import { runStreaming, type StreamOptions, type StreamResult } from './process-stream.ts';

export interface StreamedExecutionResult extends StreamResult {
  command: string;
  runId:   string;
}

/**
 * Execute a command with real-time output streaming.
 * - Emits each chunk as a step event for SSE delivery to frontend
 * - Falls back to full output on completion (no truncation)
 */
export async function executeWithStreaming(
  runId:     string,
  taskId:    string,
  stepId:    string,
  command:   string,
  opts:      Omit<StreamOptions, 'onStdout' | 'onStderr'>,
): Promise<StreamedExecutionResult> {
  let lineBuffer = '';

  const flushLine = (line: string): void => {
    if (!line.trim()) return;
    executorBus.emit('execution.step.started', {
      runId,
      taskId,
      stepId,
      stepType:  'run_command',
      label:     line.slice(0, 200),
      timestamp: new Date(),
    });
  };

  const handleChunk = (chunk: string): void => {
    lineBuffer += chunk;
    const parts = lineBuffer.split('\n');
    lineBuffer  = parts.pop() ?? '';
    parts.forEach((line) => flushLine(line));
  };

  const streamOpts: StreamOptions = {
    ...opts,
    onStdout: handleChunk,
    onStderr: handleChunk,
  };

  const result = await runStreaming(command, streamOpts);

  // Flush remaining buffer
  if (lineBuffer.trim()) flushLine(lineBuffer);

  executorLogger.info(runId, `[stream] cmd="${command}" exit=${result.exitCode} dur=${result.durationMs}ms`);

  return { ...result, command, runId };
}
