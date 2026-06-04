/**
 * server/services/chat/responder.service.ts
 *
 * LLM-based summary streamer for run completion.
 * Falls back to plain text if no LLM key is configured.
 *
 * Owns: streamRunSummary(), LLM response generation, fallback responses.
 */

import { getLLMClient, getDefaultModel, hasLLMKey } from '../../shared/llm-client.ts';
import { streamManager } from './stream.service.ts';
import type { OrchestrationResult } from '../../orchestration/types/orchestration.types.ts';

const FALLBACK_MSG = 'Run completed successfully.';

export async function streamRunSummary(
  runId:     string,
  projectId: number,
  result:    OrchestrationResult,
): Promise<void> {
  const resultSummary = result.ok
    ? `Completed ${result.workflowsCompleted} workflow(s) in ${result.durationMs}ms.`
    : (result.error ?? FALLBACK_MSG);

  if (!hasLLMKey()) {
    streamManager.open(runId, projectId);
    streamManager.append(runId, resultSummary);
    streamManager.close(runId);
    return;
  }

  streamManager.open(runId, projectId);

  try {
    const client = getLLMClient();
    const model  = getDefaultModel();

    const prompt = result.ok
      ? `Summarize this agent run result in 1–2 sentences for the user:\n\n${resultSummary}`
      : 'The agent run completed. Write a short 1-sentence confirmation for the user.';

    const stream = await client.chat.completions.create({
      model,
      messages:   [{ role: 'user', content: prompt }],
      stream:     true,
      max_tokens: 256,
    });

    for await (const chunk of stream) {
      const token = chunk.choices[0]?.delta?.content;
      if (token) streamManager.append(runId, token);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : FALLBACK_MSG;
    streamManager.append(runId, msg);
  } finally {
    streamManager.close(runId);
  }
}

export const chatResponderService = { streamRunSummary };
export const responderService      = chatResponderService;
