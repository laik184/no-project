# ERROR_FLOW_REPORT.md
**Generated:** 2026-06-05  
**Scenarios traced:** 8

---

## Scenario 1: LLM API Key Missing

```
User sends message
  → chat-orchestrator.ts: startRun()
    → chat-agent.ts: runChatAgent()
      → shared/llm-client.ts: createLLMClient()
        → resolveApiKey()
          → THROW: "No LLM API key found. Set OPENROUTER_API_KEY…"
        → chat-agent.ts catch(err): console.error + return { ok: false, error: message }
      → chat-orchestrator.ts: receives { ok: false }
        → _failRun(): runWriter.setStatus('failed').catch(() => {})  ← SILENT
        → eventPublisher: emits run_failed event
  → Frontend receives SSE run_failed event
    → No user-friendly message; raw internal string shown in timeline
```

**Gap:** LLM error reaches the frontend as a raw internal string. No recovery guidance shown.

---

## Scenario 2: Tool Not Found

```
Agent dispatches tool "fs_write_file_typo"
  → tool-dispatcher.ts: dispatch()
    → tool-resolver.ts: resolveTool("fs_write_file_typo")
      → THROW: ToolNotFoundError("Tool not found: fs_write_file_typo")
    → tool-dispatcher.ts catch: return { ok: false, error: msg, code: 'NOT_FOUND' }
  → agent coordinator receives { ok: false, code: 'NOT_FOUND' }
    → Logged as error string; passed up as generic failure
  → Frontend sees: "Tool not found: fs_write_file_typo"
```

**Gap:** Good at dispatcher level but the string bubbles up raw. No user-friendly title or suggestion.

---

## Scenario 3: Filesystem Write Failure

```
Agent dispatches fs_write_file with path outside sandbox
  → write-file.ts handler: assertInputPath()
    → resolveSafe() → THROW: "Path traversal denied: /etc/passwd"
  → write-file.ts: throw new Error(result.error ?? 'Failed to write file')
  → tool-dispatcher.ts catch: { ok: false, error: "Path traversal denied: /etc/passwd" }
  → agent receives internal path string
  → user sees raw POSIX path in error message
```

**Gap:** Internal path information leaks to the user.

---

## Scenario 4: Build Failure

```
Verifier agent runs build check
  → verifier tools call terminal spawn-process
    → Returns { exitCode: 1, stderr: "SyntaxError: Unexpected token..." }
  → verifier-agent.ts: interprets as failure
    → Returns { ok: false, error: "Build failed: SyntaxError: Unexpected token..." }
  → Orchestration receives failure
    → run_failed event emitted with raw compiler output as 'error' field
  → Frontend shows raw compiler stderr in timeline
```

**Gap:** Raw compiler output shown without categorisation or summary.

---

## Scenario 5: Verification Failure

```
Verifier agent checks runtime behaviour
  → browser tools: page.evaluate() returns unexpected state
    → screenshot saved, state logged
  → verifier returns { ok: false, error: "Expected element .btn not found" }
  → Orchestration: run_failed event with raw CSS selector in error
  → Frontend shows: "Expected element .btn not found"
```

**Gap:** Internal CSS selectors/test assertions exposed to user with no friendly summary.

---

## Scenario 6: Timeout Failure

```
Tool execution starts timer:
  → tool-dispatcher.ts: setTimeout(reject, timeoutMs)
    → reject: Error("Tool timeout after Xms")
  → catch: { ok: false, error: "Tool timeout after Xms", code: 'TIMEOUT' }
  → agent receives timeout result
    → Logs it; may retry (bounded)
    → If retries exhausted: run_failed with "Tool timeout after Xms"
```

**Gap:** "Tool timeout after Xms" is technical. User needs: "Operation timed out — the agent will retry."

---

## Scenario 7: Agent Crash (uncaught exception in agent loop)

```
Agent loop throws unexpectedly
  → executor-agent.ts catch(err): logs + returns { ok: false, error: msg }
  → orchestration/coordination/agent-coordinator.ts:95:
      catch(err) → { phase: 'failed', error: err.message }
  → run-scoped-orchestrator: transitions to FAILED phase
  → run_failed SSE event emitted
  → No process.on('uncaughtException') — if error escapes loop, process crashes
```

**Gap:** No global safety net. Unhandled exception in a background task kills the server.

---

## Scenario 8: Planner Failure

```
Planner agent cannot parse LLM output as valid plan
  → execution-planner.ts catch(err): return { ok: false, error }
    → error is raw Error object (not string)
  → agent-coordinator.ts:95: error = err instanceof Error ? err.message : String(err)
  → run_failed event with internal planner message
  → User sees: "Unexpected token < in JSON at position 0"
```

**Gap:** JSON parse error leaks to user with no context about what was being parsed.
