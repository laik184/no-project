/**
 * server/agents/chat/chat-agent.ts
 *
 * Chat Agent — handles conversational / explain intent modes.
 * Called by chat-orchestrator when intent is 'conversation' or 'explain'.
 *
 * Responsibilities:
 *   - Open a stream for the run
 *   - Call the LLM with the user goal as a conversational prompt
 *   - Stream tokens back via streamManager
 *   - Close the stream and return assembled response + token count
 *
 * Does NOT handle: build / fix / modify / debug intents (those go to the orchestration engine).
 */

import { getLLMClient, getDefaultModel, hasLLMKey } from '../../shared/llm-client.ts';
import { streamManager } from '../../chat/orchestration/stream-manager.ts';
import type { IntentMode } from '../../chat/intent/intent-router.ts';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ChatAgentInput {
  runId:      string;
  projectId:  number;
  goal:       string;
  intentMode: IntentMode;
  context?:   string;
}

export interface ChatAgentResult {
  response:  string;
  tokens?:   number;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const MAX_TOKENS  = 800;
const TEMPERATURE = 0.7;

// ── Fallback ──────────────────────────────────────────────────────────────────

function buildFallback(goal: string, intentMode: IntentMode): string {
  if (intentMode === 'explain') {
    return (
      `I'd be happy to explain that, but I don't have an LLM key configured yet. ` +
      `Connect an OpenRouter API key to enable AI responses. Your question was: "${goal.slice(0, 120)}"`
    );
  }
  return (
    `Thanks for your message! To enable AI-powered responses, please connect an ` +
    `OpenRouter API key. You said: "${goal.slice(0, 120)}"`
  );
}

// ── System prompt ─────────────────────────────────────────────────────────────

function buildSystemPrompt(intentMode: IntentMode, context?: string): string {
  const base =
    intentMode === 'explain'
      ? 'You are a knowledgeable software engineering assistant. Explain concepts clearly and concisely.'
      : 'You are a friendly, helpful AI assistant. Respond conversationally and helpfully.';

  if (context) {
    return `${base}\n\nRelevant context from memory:\n${context}`;
  }
  return base;
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Run the chat agent for conversational / explain intents.
 * Opens a stream, appends tokens, closes the stream, then returns.
 * Never throws — all failures produce a graceful fallback.
 */
export async function runChatAgent(input: ChatAgentInput): Promise<ChatAgentResult> {
  const { runId, projectId, goal, intentMode, context } = input;

  // Open stream
  streamManager.open(runId, projectId);

  // If no LLM key is available, stream a fallback and return
  if (!hasLLMKey()) {
    const fallback = buildFallback(goal, intentMode);
    streamManager.append(runId, fallback);
    const response = streamManager.close(runId);
    return { response };
  }

  try {
    const client       = getLLMClient();
    const model        = getDefaultModel();
    const systemPrompt = buildSystemPrompt(intentMode, context);

    const stream = await client.chat.completions.create({
      model,
      max_tokens:  MAX_TOKENS,
      temperature: TEMPERATURE,
      stream:      true,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: goal },
      ],
    });

    let tokenCount = 0;

    for await (const chunk of stream) {
      const token = chunk.choices[0]?.delta?.content ?? '';
      if (token) {
        streamManager.append(runId, token);
        tokenCount += 1;
      }
    }

    const response = streamManager.isActive(runId)
      ? streamManager.close(runId)
      : '';

    return { response, tokens: tokenCount };

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[chat-agent] LLM call failed:', message);

    // Stream an error message if the stream is still open
    if (streamManager.isActive(runId)) {
      const errMsg = `I ran into an issue generating a response: ${message.slice(0, 200)}. Please try again.`;
      streamManager.append(runId, errMsg);
      const response = streamManager.close(runId);
      return { response };
    }

    return { response: `Error: ${message}` };
  }
}
