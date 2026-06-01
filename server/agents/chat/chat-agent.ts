/**
 * server/agents/chat/chat-agent.ts
 *
 * Conversational LLM agent — handles messages that do NOT require
 * the Planner → Executor → Verifier orchestration pipeline.
 *
 * Usage: "hello", "what is React", "explain this pattern"
 *
 * Reuses:
 *   - getLLMClient() / hasLLMKey() from llm-client
 *   - streamManager for token delivery (same SSE path as orchestration)
 *   - eventPublisher for agent.thinking events
 *
 * Does NOT call: planner, executor, verifier, orchestrate()
 * Does NOT create: checkpoints, plans, diffs
 */

import { getLLMClient, hasLLMKey, getDefaultModel } from '../../shared/llm-client.ts';
import { streamManager }    from '../../chat/orchestration/stream-manager.ts';
import { eventPublisher }   from '../../chat/realtime/event-publisher.ts';
import type { IntentMode }  from '../../chat/intent/intent-router.ts';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ChatAgentInput {
  runId:     string;
  projectId: number;
  goal:      string;
  intentMode: IntentMode;
  /** Optional memory/context string injected by orchestrator */
  context?:  string;
}

export interface ChatAgentResult {
  response:   string;
  tokens:     number;
  durationMs: number;
  model:      string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const MAX_TOKENS  = 1500;
const TEMPERATURE = 0.7;

const SYSTEM_PROMPT = `You are Nura-X, an expert AI coding assistant embedded in an agentic development platform. You help developers build, understand, and improve software.

You have two modes:
- Conversational: greetings, general questions, clarifications — respond naturally and helpfully
- Explanatory: code concepts, architecture, patterns — respond with clear, accurate technical explanations

Rules:
- Be concise but complete. Prefer 2–4 paragraphs unless the question demands more.
- Use markdown for code blocks, lists, and emphasis when helpful.
- If the user asks you to build or create something, tell them you'll get started and they can send the request — but don't actually initiate a build in this mode.
- Never pretend you can't help. If you're unsure, say so honestly.`;

// ── Fallback ──────────────────────────────────────────────────────────────────

function buildFallback(goal: string, intentMode: IntentMode): string {
  if (intentMode === 'conversation') {
    return "Hello! I'm Nura-X, your AI coding assistant. How can I help you today?";
  }
  return `I can help explain that. Could you share a bit more context about "${goal.slice(0, 80)}" so I can give you the most accurate answer?`;
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Run the chat agent for a single conversational turn.
 *
 * Opens the stream, streams tokens via streamManager, closes the stream,
 * then returns the assembled result. The caller (chat-orchestrator) is
 * responsible for calling completeRun() / failRun() after this resolves.
 *
 * Never throws — all errors produce a fallback message.
 */
export async function runChatAgent(input: ChatAgentInput): Promise<ChatAgentResult> {
  const { runId, projectId, goal, intentMode, context } = input;
  const startedAt = Date.now();
  const model     = getDefaultModel();

  // Emit thinking state so the frontend shows the thinking bubble
  eventPublisher.publish({
    eventType: 'agent.thinking',
    runId,
    projectId,
    agentName: 'Chat',
    payload:   { text: 'Thinking…' },
  });

  // Open the token stream → emits agent.stream.start to frontend
  streamManager.open(runId, projectId);

  // ── No LLM key fallback ───────────────────────────────────────────────────
  if (!hasLLMKey()) {
    const msg = buildFallback(goal, intentMode);
    streamManager.append(runId, msg);
    return {
      response:   msg,
      tokens:     Math.ceil(msg.length / 4),
      durationMs: Date.now() - startedAt,
      model,
    };
  }

  // ── Build messages ────────────────────────────────────────────────────────
  const userContent = context
    ? `${context}\n\nUser message: ${goal}`
    : goal;

  let assembled = '';

  try {
    const client = getLLMClient();
    const stream = await client.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user',   content: userContent  },
      ],
      stream:      true,
      max_tokens:  MAX_TOKENS,
      temperature: TEMPERATURE,
    });

    for await (const chunk of stream) {
      const token = chunk.choices[0]?.delta?.content ?? '';
      if (token && streamManager.isActive(runId)) {
        streamManager.append(runId, token);
        assembled += token;
      }
    }
  } catch (err) {
    const fallback = buildFallback(goal, intentMode);
    if (streamManager.isActive(runId)) {
      streamManager.append(runId, fallback);
    }
    assembled = fallback;
    console.error('[chat-agent] LLM error:', err instanceof Error ? err.message : String(err));
  }

  const response   = assembled || buildFallback(goal, intentMode);
  const durationMs = Date.now() - startedAt;

  return {
    response,
    tokens:     Math.ceil(response.length / 4),
    durationMs,
    model,
  };
}
