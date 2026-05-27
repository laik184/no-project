# server/agents/coder/ — Deep Scan Report

**Date:** 2025-05-27  
**Folder:** `server/agents/coder/`  
**Total Files:** 42  
**Purpose:** Yeh folder **Coder Agent** ka core hai — jo do modes mein kaam karta hai:
1. **Autonomous LLM Tool-Calling Loop** — complex tasks ke liye
2. **Template-Based Generation** — standard coding patterns ke liye

---

## Folder Structure Overview

```
server/agents/coder/
├── index.ts                     ← Entry Point
├── browser/
│   ├── browser-context.ts
│   ├── browser-feedback.ts
│   ├── console-analysis.ts
│   └── screenshot-analysis.ts
├── coding/
│   ├── api-generator.ts
│   ├── auth-generator.ts
│   ├── backend-generator.ts
│   ├── component-generator.ts
│   ├── database-generator.ts
│   └── frontend-generator.ts
├── context/
│   ├── architecture-context.ts
│   ├── dependency-context.ts
│   ├── file-context.ts
│   └── project-context.ts
├── llm/
│   ├── completion-detector.ts
│   ├── llm-client.ts
│   ├── prompt-builder.ts
│   ├── response-parser.ts
│   ├── tool-context.ts
│   ├── tool-dispatcher.ts
│   ├── tool-loop.ts             ← AGENT CORE
│   └── tool-observation.ts
├── memory/
│   ├── execution-memory.ts
│   ├── failure-memory.ts
│   ├── runtime-memory.ts
│   └── tool-memory.ts
├── planning/
│   ├── action-selector.ts
│   ├── execution-strategy.ts
│   ├── task-interpreter.ts
│   └── tool-selection.ts
├── templates/
│   ├── api-template.ts
│   ├── auth-template.ts
│   ├── crud-template.ts
│   ├── express-template.ts
│   └── react-template.ts
├── tools/
│   ├── tool-contracts.ts
│   ├── tool-registry.ts
│   ├── tool-result.ts
│   ├── tool-schema.ts
│   └── tool-validator.ts
└── utils/
    └── code-utils.ts
```

---

## Root

### `index.ts`
- **Type:** Entry Point / Utility
- **Kya karta hai:** Pura coder agent ka public API — `runToolLoop` aur `interpretTask` bahar export karta hai
- **Connections:** `/llm`, `/planning`, `/coding`, `/memory` se re-export karta hai

---

## /llm — Agent ka "Dimaag" (Core Engine)

### `tool-loop.ts` ⭐
- **Type:** AGENT — Core Logic
- **Kya karta hai:** Sabse important file. Yeh iterative execution engine hai jo poora loop chalata hai:
  **Prompt → LLM Call → Tool Dispatch → Observation → Loop (repeat)**
- **Connections:** `/llm`, `/tools`, `/memory` — sab ka central hub

### `llm-client.ts`
- **Type:** Utility
- **Kya karta hai:** OpenAI/OpenRouter client initialize karta hai, model configuration provide karta hai
- **Connections:** `tool-loop.ts` use karta hai

### `prompt-builder.ts`
- **Type:** Utility / Template
- **Kya karta hai:** System aur user prompts construct karta hai — task description aur environment observations inject karta hai
- **Connections:** `tool-loop.ts` use karta hai

### `response-parser.ts`
- **Type:** Utility
- **Kya karta hai:** LLM ka raw output leke structured tool calls aur text content mein convert karta hai
- **Connections:** `tool-loop.ts` use karta hai

### `tool-dispatcher.ts`
- **Type:** Utility (Router)
- **Kya karta hai:** Structured tool calls (e.g., `write_file`) ko actual filesystem ya runtime implementation pe route karta hai
- **Connections:** `server/agents/filesystem/` aur `server/agents/runtime/` se import karta hai

### `tool-context.ts`
- **Type:** Utility
- **Kya karta hai:** Files, dependencies, architecture sab ek context object mein pack karta hai — prompt mein inject hone ke liye
- **Connections:** `/context` folder ke files use karta hai; `tool-loop.ts` isko call karta hai

### `tool-observation.ts`
- **Type:** Utility / Store
- **Kya karta hai:** Har tool execution ka result record aur store karta hai — next LLM turn mein feed back hota hai
- **Connections:** `tool-loop.ts` use karta hai

### `completion-detector.ts`
- **Type:** Utility
- **Kya karta hai:** LLM responses analyze karta hai — task complete hua ya nahi, loop mein atka hua hai ya aur turns chahiye
- **Connections:** `tool-loop.ts` call karta hai

---

## /planning — Task Samajhna aur Strategy

### `task-interpreter.ts`
- **Type:** Utility
- **Kya karta hai:** Natural language tasks ko structured plans mein parse karta hai
- **Connections:** Planning pipeline ka pehla step

### `execution-strategy.ts`
- **Type:** Utility
- **Kya karta hai:** Decide karta hai — yeh task **template se solve hoga** ya **autonomous tool-loop** chahiye
- **Connections:** `task-interpreter.ts` ke baad call hota hai

### `action-selector.ts`
- **Type:** Utility
- **Kya karta hai:** Kaunsa generator ya tool set appropriate hai given task ke liye — select karta hai
- **Connections:** `execution-strategy.ts` ke baad use hota hai

### `tool-selection.ts`
- **Type:** Utility
- **Kya karta hai:** Task type ke hisaab se LLM ko sirf relevant tools dikhata hai — irrelevant tools hide karta hai
- **Connections:** `tool-loop.ts` mein inject hota hai

---

## /coding — Static Code Generation (Template-Based)

### `api-generator.ts`
- **Type:** Generator (Utility)
- **Kya karta hai:** Express/Node.js API route handlers aur CRUD endpoints generate karta hai
- **Connections:** `templates/api-template.ts` aur `utils/code-utils.ts` use karta hai

### `auth-generator.ts`
- **Type:** Generator (Utility)
- **Kya karta hai:** Authentication-related logic aur boilerplate generate karta hai
- **Connections:** `templates/auth-template.ts` use karta hai

### `backend-generator.ts`
- **Type:** Generator (Utility)
- **Kya karta hai:** Backend-specific file generation ka orchestrator
- **Connections:** Various backend templates use karta hai

### `frontend-generator.ts`
- **Type:** Generator (Utility)
- **Kya karta hai:** Frontend-specific file generation ka orchestrator
- **Connections:** Various frontend templates use karta hai

### `component-generator.ts`
- **Type:** Generator (Utility)
- **Kya karta hai:** React components, forms, aur layout structures generate karta hai
- **Connections:** `templates/crud-template.ts` aur `utils/code-utils.ts` use karta hai

### `database-generator.ts`
- **Type:** Generator (Utility)
- **Kya karta hai:** Database schemas aur migration scripts generate karta hai
- **Connections:** Database-related templates use karta hai

---

## /context — Project Ki Jaankari LLM Ko Dena

### `project-context.ts`
- **Type:** Utility (Manager)
- **Kya karta hai:** High-level manager — sab context types gather karta hai
- **Connections:** Doosre context files orchestrate karta hai

### `architecture-context.ts`
- **Type:** Utility
- **Kya karta hai:** Project ka architectural overview extract karta hai — tech stack, main entry points
- **Connections:** `llm/tool-context.ts` use karta hai

### `dependency-context.ts`
- **Type:** Utility
- **Kya karta hai:** `package.json` padhke installed dependencies ki list LLM ko provide karta hai
- **Connections:** `llm/tool-context.ts` use karta hai

### `file-context.ts`
- **Type:** Utility
- **Kya karta hai:** Specific relevant files ka content aur metadata gather karta hai
- **Connections:** `llm/tool-context.ts` use karta hai

---

## /memory — State Yaad Rakhna

### `execution-memory.ts`
- **Type:** Store (Utility)
- **Kya karta hai:** Successful task executions ka history store karta hai

### `failure-memory.ts`
- **Type:** Store (Utility)
- **Kya karta hai:** Errors aur failed tool attempts record karta hai — taaki LLM dobara same galti na kare
- **Connections:** `tool-loop.ts` isme likhta hai

### `runtime-memory.ts`
- **Type:** Store (Utility)
- **Kya karta hai:** Current execution session ka volatile/temporary memory

### `tool-memory.ts`
- **Type:** Store (Utility)
- **Kya karta hai:** Tool usage patterns specifically track karta hai

---

## /browser — UI Feedback Loop

### `browser-context.ts`
- **Type:** Store (Utility)
- **Kya karta hai:** Browser snapshots (errors, screenshots, metadata) ka in-memory store
- **Connections:** `browser-feedback.ts` isse state retrieve karta hai

### `browser-feedback.ts`
- **Type:** Aggregator (Utility)
- **Kya karta hai:** Console + screenshot analysis mila ke executor ko actionable feedback deta hai
- **Connections:** `console-analysis.ts` aur `screenshot-analysis.ts` call karta hai; `browser-context.ts` padhta hai

### `console-analysis.ts`
- **Type:** Utility
- **Kya karta hai:** Raw console logs parse karke specific error patterns detect karta hai (missing modules, syntax errors) aur suggestions deta hai
- **Connections:** `browser-feedback.ts` import karta hai

### `screenshot-analysis.ts`
- **Type:** Utility
- **Kya karta hai:** Screenshots heuristically analyze karta hai (file size se) — blank pages ya crashes detect karta hai
- **Connections:** `browser-feedback.ts` import karta hai

---

## /tools — LLM aur System ke beech Bridge

### `tool-schema.ts`
- **Type:** Schema / Template
- **Kya karta hai:** OpenAI function calling ke liye JSON Schema definitions

### `tool-registry.ts`
- **Type:** Configuration (Utility)
- **Kya karta hai:** Har tool ki metadata registry — category, mutates, idempotent flags

### `tool-contracts.ts`
- **Type:** Types (Utility)
- **Kya karta hai:** Tool arguments ke TypeScript interfaces (Input/Output)

### `tool-validator.ts`
- **Type:** Utility
- **Kya karta hai:** Tool arguments ko schema ke against validate karta hai — execution se pehle

### `tool-result.ts`
- **Type:** Utility
- **Kya karta hai:** Har tool ka result ek standard format/structure mein wrap karta hai

---

## /templates — Ready-Made Code Boilerplate

### `api-template.ts`
- **Type:** Template
- **Kya karta hai:** API routes ka hardcoded string-based boilerplate

### `auth-template.ts`
- **Type:** Template
- **Kya karta hai:** Auth logic ka hardcoded boilerplate

### `crud-template.ts`
- **Type:** Template
- **Kya karta hai:** CRUD operations ka ready-made boilerplate

### `express-template.ts`
- **Type:** Template
- **Kya karta hai:** Express server setup ka boilerplate

### `react-template.ts`
- **Type:** Template
- **Kya karta hai:** React app structure ka boilerplate

---

## /utils

### `code-utils.ts`
- **Type:** Utility
- **Kya karta hai:** String manipulation helpers — kebab-case, PascalCase conversion, file headers generation
- **Connections:** `/coding` aur `/templates` mein widely use hota hai

---

## Complete Flow (Kaise Kaam Karta Hai)

```
User Task Input
      │
      ▼
planning/task-interpreter.ts
(Natural language → Structured plan)
      │
      ▼
planning/execution-strategy.ts
(Template kaafi hai? Ya tool-loop chahiye?)
      │
      ├──── Simple Task ──────────────────────────────────▶ coding/
      │                                                    (api/auth/backend/
      │                                                     frontend/component/
      │                                                     database generator)
      │                                                          │
      │                                                          ▼
      │                                                    templates/
      │                                                    (ready-made boilerplate)
      │
      └──── Complex Task ────────────────────────────────▶ llm/tool-loop.ts ⭐ AGENT CORE
                                                                │
                    ┌───────────────────────────────────────────┤
                    │                                           │
                    ▼                                           ▼
            llm/prompt-builder.ts                    context/ (project info)
            (prompt construct karo)                  planning/tool-selection.ts
                    │                                (relevant tools select karo)
                    ▼
            llm/llm-client.ts
            (LLM ko call karo — OpenRouter)
                    │
                    ▼
            llm/response-parser.ts
            (Response parse karo → tool calls)
                    │
                    ▼
            llm/tool-dispatcher.ts
            (Tool actually execute karo)
                    │
                    ▼
            llm/tool-observation.ts
            (Result store karo)
                    │
                    ▼
            memory/ (yaad rakho)
            browser/ (UI feedback lo)
                    │
                    ▼
            llm/completion-detector.ts
            (Task complete? Ya loop dobara?)
                    │
              ┌─────┴─────┐
              │           │
           Complete    Loop Again
```

---

## Type Classification Summary

| Type | Count | Files |
|------|-------|-------|
| **AGENT (Core)** | 1 | `llm/tool-loop.ts` |
| **Generator** | 6 | `/coding` ke sab files |
| **Template** | 5 | `/templates` ke sab files |
| **Store/Memory** | 5 | `/memory` ke sab + `browser-context.ts` + `tool-observation.ts` |
| **Utility** | 25 | Baaki sab files |
| **Entry Point** | 1 | `index.ts` |

---

*Report generated from deep scan of `server/agents/coder/` — 42 files total*
