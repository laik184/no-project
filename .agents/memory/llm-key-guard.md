---
name: LLM key guard pattern
description: How to surface a helpful message when OPENROUTER_API_KEY is missing instead of crashing silently.
---

## Rule
Always call `hasLLMKey()` from `server/shared/llm-client.ts` at the TOP of any agent or orchestrator entry point that will invoke the LLM. Return a user-visible error early rather than letting failures cascade deep in the tool chain.

## Implementation
In `chat-orchestrator.ts` `startRun()`, just before `void orchestrate(...)`:

```typescript
if (!hasLLMKey()) {
  void (async () => {
    streamManager.open(runId, payload.projectId);
    streamManager.append(runId, '⚠️ No OpenRouter API key found. Add OPENROUTER_API_KEY in Replit Secrets.');
    streamManager.close(runId);
    await _completeRun(run, turn.turnId);
  })();
  return run;
}
```

## Key resolution order (from llm-client.ts)
1. `process.env.OPENROUTER_API_KEY` — user-provided
2. `process.env.AI_INTEGRATIONS_OPENROUTER_API_KEY` — Replit managed OpenRouter integration

## Why
Without the guard, the planner phase runs fine (it's deterministic), but the executor hits coding tools that call `getLLMClient()` which throws immediately. The throw is caught per-task but the entire orchestration still fails with unhelpful error messages scattered across logs.

## How to apply
- Add `hasLLMKey()` check at the start of `startRun()` or any direct LLM caller.
- Never swallow the error silently — always surface it in the SSE stream.
- The user MUST set `OPENROUTER_API_KEY` in Replit Secrets for code generation to work.
