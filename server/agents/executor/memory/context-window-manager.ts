/**
 * server/agents/executor/memory/context-window-manager.ts
 *
 * LLM context governance for the executor agent.
 * Manages token budgeting, context trimming, priority insertion, and
 * long-workflow compression so prompts never exceed model context limits.
 *
 * Estimation: 1 token ≈ 4 chars (GPT-4 approximation).
 * No LLM calls here — pure transformation logic.
 */

// ── Config ────────────────────────────────────────────────────────────────────

export interface ContextWindowConfig {
  maxTokens:      number;
  reservedTokens: number;   // reserved for the system prompt / response
  compressionRatio: number; // 0–1; how aggressively to trim older content
}

const DEFAULT_CONFIG: ContextWindowConfig = {
  maxTokens:       8_000,
  reservedTokens:  2_000,
  compressionRatio: 0.4,
};

// ── Message priority ──────────────────────────────────────────────────────────

export type MessagePriority = 'critical' | 'high' | 'normal' | 'low';

export interface ContextMessage {
  id:        string;
  role:      'system' | 'user' | 'assistant' | 'tool';
  content:   string;
  priority:  MessagePriority;
  ts:        number;
  tokenEst:  number;
}

// ── Store ─────────────────────────────────────────────────────────────────────

const _windows = new Map<string, ContextMessage[]>();

function _estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function _priorityWeight(p: MessagePriority): number {
  return p === 'critical' ? 4 : p === 'high' ? 3 : p === 'normal' ? 2 : 1;
}

function _summarise(messages: ContextMessage[]): ContextMessage {
  const count   = messages.length;
  const summary = `[Compressed: ${count} prior message(s) omitted. ` +
    `Last tool outputs and task descriptions elided for context budget.]`;
  return {
    id:       `summary_${Date.now()}`,
    role:     'assistant',
    content:  summary,
    priority: 'low',
    ts:       Date.now(),
    tokenEst: _estimateTokens(summary),
  };
}

// ── API ───────────────────────────────────────────────────────────────────────

export const contextWindowManager = {
  init(runId: string): void {
    if (!_windows.has(runId)) _windows.set(runId, []);
  },

  push(
    runId:    string,
    role:     ContextMessage['role'],
    content:  string,
    priority: MessagePriority = 'normal',
    id?:      string,
  ): ContextMessage {
    const msgs = _windows.get(runId) ?? [];
    const msg: ContextMessage = {
      id:       id ?? `ctx_${Date.now()}_${msgs.length}`,
      role,
      content,
      priority,
      ts:       Date.now(),
      tokenEst: _estimateTokens(content),
    };
    msgs.push(msg);
    _windows.set(runId, msgs);
    return msg;
  },

  /** Trim context to fit within budget, preserving high-priority messages. */
  trim(runId: string, config: Partial<ContextWindowConfig> = {}): ContextMessage[] {
    const cfg     = { ...DEFAULT_CONFIG, ...config };
    const budget  = cfg.maxTokens - cfg.reservedTokens;
    const msgs    = _windows.get(runId) ?? [];
    if (msgs.length === 0) return [];

    let total = msgs.reduce((s, m) => s + m.tokenEst, 0);
    if (total <= budget) return msgs;

    // Sort by priority descending, then by recency (keep newest)
    const sorted = [...msgs].sort((a, b) => {
      const pw = _priorityWeight(b.priority) - _priorityWeight(a.priority);
      return pw !== 0 ? pw : b.ts - a.ts;
    });

    const kept:    ContextMessage[] = [];
    const dropped: ContextMessage[] = [];
    let   used = 0;

    for (const m of sorted) {
      if (used + m.tokenEst <= budget) {
        kept.push(m);
        used += m.tokenEst;
      } else {
        dropped.push(m);
      }
    }

    // Insert a compression summary if we dropped anything
    if (dropped.length > 0) {
      const summary = _summarise(dropped);
      kept.unshift(summary);
    }

    // Restore chronological order
    const result = kept.sort((a, b) => a.ts - b.ts);
    _windows.set(runId, result);
    return result;
  },

  /** Return current messages, optionally trimming first. */
  getMessages(runId: string, autoTrim = true, config?: Partial<ContextWindowConfig>): ContextMessage[] {
    if (autoTrim) return this.trim(runId, config);
    return _windows.get(runId) ?? [];
  },

  /** Return estimated token usage for a run. */
  tokenUsage(runId: string): { estimated: number; budget: number; overBudget: boolean } {
    const msgs      = _windows.get(runId) ?? [];
    const estimated = msgs.reduce((s, m) => s + m.tokenEst, 0);
    const budget    = DEFAULT_CONFIG.maxTokens - DEFAULT_CONFIG.reservedTokens;
    return { estimated, budget, overBudget: estimated > budget };
  },

  clear(runId: string): void { _windows.delete(runId); },
  size():  number { return _windows.size; },
};
