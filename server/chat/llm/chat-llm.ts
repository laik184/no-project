/**
 * server/chat/llm/chat-llm.ts
 *
 * LLM streaming helper — chat layer internal.
 * Handles conversational / explain intent modes directly within the chat layer.
 *
 * Moved here from server/agents/chat/chat-agent.ts to fix the architecture
 * violation where chat (service layer) was importing from agents (agent layer).
 *
 * Allowed imports: shared (↓), infrastructure (↓)
 * Must NOT import from server/agents/*
 */

import { getLLMClient, getDefaultModel, hasLLMKey } from '../../shared/llm-client.ts';

// ── StreamWriter interface ────────────────────────────────────────────────────

export interface StreamWriter {
  append(token: string): void;
  close(): string;
  isActive(): boolean;
}

// ── Intent mode ───────────────────────────────────────────────────────────────

export type ChatIntentMode =
  | 'conversation'
  | 'build'
  | 'fix'
  | 'modify'
  | 'debug'
  | 'explain';

// ── Input / Result types ──────────────────────────────────────────────────────

export interface ChatLLMInput {
  runId:      string;
  projectId:  number;
  goal:       string;
  intentMode: ChatIntentMode;
  context?:   string;
}

export interface ChatLLMResult {
  response: string;
  tokens?:  number;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const MAX_TOKENS  = 800;
const TEMPERATURE = 0.7;

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildFallback(goal: string, intentMode: ChatIntentMode): string {
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

function buildSystemPrompt(intentMode: ChatIntentMode, context?: string): string {
  const base =
    intentMode === 'explain'
      ? 'You are a knowledgeable software engineering assistant. Explain concepts clearly and concisely.'
      : 'You are a friendly, helpful AI assistant. Respond conversationally and helpfully.';

  return context ? `${base}\n\nRelevant context from memory:\n${context}` : base;
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Stream an LLM response for conversational / explain intents.
 *
 * The caller must open the stream and construct a StreamWriter before calling.
 * This function appends tokens to the writer, then calls close() and returns.
 * Never throws — all failures produce a graceful fallback via the writer.
 */
export async function runChatLLM(
  input:  ChatLLMInput,
  stream: StreamWriter,
): Promise<ChatLLMResult> {
  const { goal, intentMode, context } = input;

  if (!hasLLMKey()) {
    const fallback = buildFallback(goal, intentMode);
    stream.append(fallback);
    const response = stream.close();
    return { response };
  }

  try {
    const client       = getLLMClient();
    const model        = getDefaultModel();
    const systemPrompt = buildSystemPrompt(intentMode, context);

    const completion = await client.chat.completions.create({
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

    for await (const chunk of completion) {
      const token = chunk.choices[0]?.delta?.content ?? '';
      if (token) {
        stream.append(token);
        tokenCount += 1;
      }
    }

    const response = stream.isActive() ? stream.close() : '';
    return { response, tokens: tokenCount };

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[chat-llm] LLM call failed:', message);

    if (stream.isActive()) {
      const errMsg = `I ran into an issue generating a response: ${message.slice(0, 200)}. Please try again.`;
      stream.append(errMsg);
      const response = stream.close();
      return { response };
    }

    return { response: `Error: ${message}` };
  }
}
