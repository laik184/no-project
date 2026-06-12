# Prompt Contract / System Prompt

> How NURAX structures the messages it sends to the LLM — the "contract" between the orchestration layer and the language model.

---

## Overview

NURAX uses **three distinct prompt contracts**, each tuned for a different interaction mode:

| Mode | Used by | LLM? | Contract style |
|---|---|---|---|
| **Conversational** | Chat agent, explain mode | ✅ Yes | Soft persona, freeform response |
| **CodeGen** | CoderX, coding tools | ✅ Yes | Strict JSON-only response |
| **Planner** | Planner agent | ❌ No | Rule-based engine (no LLM) |

---

## 1. Conversational Contract

**Files:** `server/chat/llm/chat-llm.ts`, `server/agents/chat/chat-agent.ts`

Used when the user asks a question, requests an explanation, or chats casually.

### System Prompt

Built dynamically at call time. Base personas:

```
explain mode:
  "You are a knowledgeable software engineering assistant.
   Explain concepts clearly and concisely."

conversation mode:
  "You are a friendly, helpful AI assistant.
   Respond conversationally and helpfully."
```

Memory context is appended when relevant:

```
[Base Persona]

Relevant context from memory:
[Recalled entries from vector store — past decisions, lessons, architecture notes]
```

### Message Structure

```typescript
messages: [
  { role: "system",    content: dynamicSystemPrompt },
  { role: "user",      content: userMessage }
]
```

History is formatted by `server/chat/context/context-builder.ts` as:

```
[System]
{systemPrompt}

[User]
{message}

[Assistant]
{previousResponse}
```

### Response format

Free-form text. No schema enforcement. Streamed to the frontend via SSE.

---

## 2. CodeGen Contract (Strict)

**File:** `server/tools/coding/llm/prompt-builder.ts`

Used by CoderX and all coding tools. This is the most tightly controlled contract in the system.

### System Preamble

```
You are CodeGen — a precise TypeScript code generation engine.

Rules:
- Respond ONLY with valid JSON. No prose, no markdown fences, no explanation.
- Never generate stubs, TODOs, or placeholder comments.
- Every file must be complete and immediately runnable.
- Follow the framework rules below exactly.
```

### Framework Rules (injected into system prompt)

```
React:
  - Functional components only, no class components
  - Use React Query for data fetching (@tanstack/react-query v5 object form)
  - Tailwind CSS for all styling — no inline styles
  - Import from @/components/ui/* for shadcn components

Express:
  - All routes in dedicated router files
  - Validate request bodies with Zod before touching storage
  - Return { ok: boolean, data?, error? } envelope on all endpoints
  - Never throw inside route handlers — use try/catch with res.status()

TypeScript:
  - Strict mode always on
  - No `any` unless truly unavoidable (annotate with // eslint-disable-line)
  - Use Drizzle ORM types from shared/schema.ts, never hand-write DB types
```

### Response Schema (enforced via Zod post-parse)

```typescript
{
  "files": {
    "<relative/path/to/file.ts>": "<full file content as string>",
    "<another/file.tsx>": "<full content>"
  },
  "summary": "<one-sentence description of what was generated>"
}
```

If the LLM response cannot be parsed against this schema, the request is retried (up to 3 times) with the parse error appended as a correction prompt.

### Message Structure

```typescript
messages: [
  { role: "system", content: SYSTEM_PREAMBLE + FRAMEWORK_RULES },
  { role: "user",   content: taskDescription + "\n\n" + memoryContext }
]
```

Memory context is always appended to the user turn — not the system turn — so the model treats it as project-specific facts rather than permanent instructions.

---

## 3. Planner Engine (No LLM)

**File:** `server/agents/planner/engine/index.ts`

The Planner deliberately does **not** use an LLM for its core logic. Instead it uses a deterministic rule engine:

### Step 1 — Keyword classification

Scans the goal string for domain keywords:

```
"frontend"  → keywords: page, component, ui, react, form, button, layout …
"api"       → keywords: route, endpoint, rest, controller, handler …
"database"  → keywords: schema, table, migration, drizzle, model …
"auth"      → keywords: login, signup, session, jwt, oauth …
"styling"   → keywords: tailwind, theme, css, color, dark mode …
```

### Step 2 — Dependency injection

Hard-coded dependency rules applied after classification:

```
frontend  depends on  api
api       depends on  database
auth      depends on  database
```

### Step 3 — Wave assembly

Tasks with no unresolved dependencies form "Wave 1" and execute in parallel. When Wave 1 completes, newly unblocked tasks form "Wave 2", and so on.

### Why no LLM here?

LLM-based planning is non-deterministic and slow. For a system that runs hundreds of plans, keyword + dependency rules are:
- Reproducible across runs
- ~100× faster (no API call)
- Easier to audit and extend

---

## Memory Injection Pattern

All three modes share the same memory retrieval call:

```typescript
const memoryContext = await buildMemoryContext(projectId);
// Returns a formatted string like:
//
// Past architecture decisions:
// - Chose Drizzle ORM over Prisma (2024-06-10): better TypeScript inference
//
// Known failure patterns:
// - React Query v5 requires object form: useQuery({ queryKey: [...] })
//
// Recent lessons:
// - Always run `npx drizzle-kit push` before starting the dev server
```

This string is injected into the user turn of the message array (not the system prompt) so it is treated as project-specific runtime context.

---

## LLM Client Configuration

**File:** `server/shared/llm-client.ts`

Key resolution (in priority order):

```
1. OPENROUTER_API_KEY                  — user-provided key
2. AI_INTEGRATIONS_OPENROUTER_API_KEY  — Replit managed integration
```

Base URL resolution:

```
1. AI_INTEGRATIONS_OPENROUTER_BASE_URL — Replit managed
2. LLM_BASE_URL env var                — manual override
3. https://openrouter.ai/api/v1        — hardcoded default
```

Model selection: `LLM_MODEL` env var (default: `openai/gpt-oss-120b:free`)

---

## Error & Retry Behaviour

| Scenario | Behaviour |
|---|---|
| JSON parse failure (CodeGen) | Retry with parse error appended to user turn, up to 3× |
| LLM timeout | Surface as `LLMTimeoutError`, agent logs and aborts task |
| No API key | Immediate `ConfigurationError` — no silent fallback |
| Rate limit (429) | Exponential back-off via `p-retry`, max 5 attempts |
