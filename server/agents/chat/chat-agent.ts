/**
 * server/agents/chat/chat-agent.ts
 *
 * Chat Agent — handles conversational / explain intent modes.
 * Called by chat-orchestrator when intent is 'conversation' or 'explain'.
 *
 * Responsibilities:
 *   - Accept an injected StreamWriter and stream LLM tokens through it
 *   - Call the LLM with the user goal as a conversational prompt
 *   - Return assembled response + token count
 *
 * Does NOT handle: build / fix / modify / debug intents (those go to the orchestration engine).
 *
 * Architecture contract:
 *   This file must NEVER import from server/chat/*
 *   The stream is injected via StreamWriter — chat-agent has no knowledge of stream-manager.
 */

import { getLLMClient, getDefaultModel, hasLLMKey } from '../../shared/llm-client.ts';

// ── StreamWriter interface ─────────────────────────────────────────────────────
//
// Injected by the caller (chat-orchestrator). The agent uses only this narrow
// interface — it has no knowledge of stream-manager or any chat-layer module.

export interface StreamWriter {
  append(token: string): void;
  close(): string;
  isActive(): boolean;
}

// ── Intent mode — defined locally to avoid importing chat layer ───────────────
//
// Must stay structurally compatible with IntentMode in chat/intent/intent-router.ts.

export type ChatIntentMode =
  | 'conversation'
  | 'build'
  | 'fix'
  | 'modify'
  | 'debug'
  | 'explain';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ChatAgentInput {
  runId:      string;
  projectId:  number;
  goal:       string;
  intentMode: ChatIntentMode;
  context?:   string;
}

export interface ChatAgentResult {
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
 * Run the chat agent for conversational / explain intents.
 *
 * The caller must open the stream and construct a StreamWriter before calling.
 * This function appends tokens to the writer, then calls close() and returns.
 * Never throws — all failures produce a graceful fallback via the writer.
 */
export async function runChatAgent(
  input:  ChatAgentInput,
  stream: StreamWriter,
): Promise<ChatAgentResult> {
  const { goal, intentMode, context } = input;

  // No LLM key: stream a fallback and close
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
    console.error('[chat-agent] LLM call failed:', message);

    if (stream.isActive()) {
      const errMsg = `I ran into an issue generating a response: ${message.slice(0, 200)}. Please try again.`;
      stream.append(errMsg);
      const response = stream.close();
      return { response };
    }

    return { response: `Error: ${message}` };
  }
}
