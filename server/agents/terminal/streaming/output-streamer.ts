import { runStreaming }     from './process-stream.ts';
import { LineParser }       from './line-parser.ts';
import { publishEvent }     from '../events/event-publisher.ts';
import { runtimeLogger }    from '../telemetry/runtime-logger.ts';
import type { StreamOptions, StreamResult } from '../types/stream.types.ts';

export interface StreamedResult extends StreamResult {
  command: string;
  runId:   string;
}

export async function executeWithStreaming(
  runId:   string,
  command: string,
  opts:    Omit<StreamOptions, 'onStdout' | 'onStderr'>,
): Promise<StreamedResult> {
  const parser = new LineParser();

  const emitLines = (chunk: string, type: 'stdout' | 'stderr'): void => {
    const lines = parser.flush(chunk);
    for (const line of lines) {
      if (line.isEmpty) continue;
      publishEvent('terminal.stream.chunk', {
        runId,
        chunk:     line.raw,
        type,
        timestamp: line.timestamp,
      });
    }
  };

  const result = await runStreaming(command, {
    ...opts,
    onStdout: (c) => emitLines(c, 'stdout'),
    onStderr: (c) => emitLines(c, 'stderr'),
  });

  for (const line of parser.drain()) {
    if (!line.isEmpty) {
      publishEvent('terminal.stream.chunk', {
        runId, chunk: line.raw, type: 'stdout', timestamp: line.timestamp,
      });
    }
  }

  runtimeLogger.info(runId, `[stream] exit=${result.exitCode} dur=${result.durationMs}ms`, {
    command, truncated: result.truncated,
  });

  return { ...result, command, runId };
}
