# PRD — Product Requirements Document
### NURAX — AI-Powered Full-Stack Application Builder

---

## 1. APP KYA HAI?

**NURAX** ek **browser-based, AI-powered application builder** hai.

Aap apni app ka idea type karo — plain language mein — aur NURAX ke autonomous AI agents milke woh poora app banate hain. Code likhna, files banana, bugs fix karna, commands run karna, live preview dikhana — sab kuch automatically.

### Simple Definition
> *Aap bolo "Todo app banao React mein" — NURAX banata hai.*

### Yeh Kya Hai Category Mein
Replit, Bolt.new, aur Cursor jaise platforms ki category mein aata hai — lekin iska architecture zyada layered aur enterprise-grade hai ek **multi-agent system** ke saath.

### Package Name
`nura-x-deployer` (lekin capabilities sirf deployment se kaafi zyada broad hain)

---

## 2. KIS PROBLEM KO SOLVE KARTA HAI?

### Core Problem
Ek product idea se working web application tak pohonchne mein bohot zyada waqt, skill aur effort lagta hai:

| Problem | Detail |
|---|---|
| **Skill Gap** | Non-technical founders ko code nahi aata, developer hire karna padta hai sirf ek prototype ke liye |
| **Context Loss** | Developer har baar naye project mein sab kuch bhool jaata hai — architecture decisions, past bugs |
| **Manual Everything** | Planning, coding, testing, debugging, deployment — sab manually karna padta hai |
| **Tool Fragmentation** | IDE alag, terminal alag, preview alag, deployment alag — sab ka context alag |
| **AI Tools Incomplete** | ChatGPT/Copilot sirf code suggest karte hain — poora workflow handle nahi karte |

### NURAX Ka Solution
```
User ka plain-text idea
        ↓
Planner Agent → goal ko tasks mein todta hai
        ↓
CoderX Agent → actual code likhta hai
        ↓
Filesystem Agent → files create/edit karta hai
        ↓
Terminal Agent → npm install, build commands run karta hai
        ↓
Verifier Agent → type-check + build verify karta hai
        ↓
Preview System → live app browser mein dikhata hai
        ↓
User ko milta hai: Working Application
```

### Problems Solved
1. **Idea → App gap** — Natural language se directly runnable application
2. **Context memory** — Memory system past decisions, bugs, learnings yaad rakhta hai
3. **Automatic verification** — Verifier agent khud type-check aur build karta hai
4. **Integrated workspace** — Chat, editor, terminal, preview — ek hi jagah
5. **Rollback safety** — Checkpoints ke zariye kisi bhi state pe wapas jaao

---

## 3. USER KYA KAREGA?

### Target User Types

#### User Type 1 — Product Founder / Non-Technical Builder
| | Detail |
|---|---|
| **Background** | Code nahi aata |
| **Goal** | App idea ko working prototype mein convert karna |
| **NURAX mein kya karega** | Idea describe karega → agent se banwayega → preview dekhega → feedback dega |
| **Value** | Bina code likhe working prototype |

#### User Type 2 — Developer (AI-Assisted Coding)
| | Detail |
|---|---|
| **Background** | Full-stack developer |
| **Goal** | AI se boring/repetitive work karwana, khud review karna |
| **NURAX mein kya karega** | Chat se features add karega, Monaco editor mein files edit karega, terminal use karega, checkpoints lega |
| **Value** | 80% kaam agent se, 20% developer review/refine karta hai |

#### User Type 3 — Technical Lead / Operator
| | Detail |
|---|---|
| **Background** | Engineering manager ya CTO |
| **Goal** | Team productivity track karna, deployment manage karna |
| **NURAX mein kya karega** | Usage dashboard dekhega, integrations configure karega, publishing settings manage karega |
| **Value** | Centralized workspace with metrics aur publishing |

---

## 4. CORE FEATURES KYA HAIN?

### Feature Overview Table

| # | Feature | Kya Karta Hai | Status |
|---|---|---|---|
| 1 | **Project Management** | Workspace create/manage karo | ✅ Working |
| 2 | **Chat + Agent Runs** | AI se app banwao | ✅ Core working |
| 3 | **Multi-Agent System** | 9 specialized AI agents | ✅ Working |
| 4 | **Tool Registry** | 158 executable tools | ✅ Working |
| 5 | **File Explorer** | Sandbox files dekho/edit karo | ✅ Working |
| 6 | **Monaco Code Editor** | VS Code jesa editor | ✅ Working |
| 7 | **Terminal** | Shell commands run karo | ✅ Working |
| 8 | **Preview / Runtime** | Live app browser mein dekho | ✅ Working |
| 9 | **Realtime Streaming** | Agent actions live dekho | ✅ Working |
| 10 | **Checkpoints + Rollback** | File state capture + restore | ⚠️ Partial |
| 11 | **Memory Platform** | AI past decisions yaad rakhta hai | ⚠️ Partial |
| 12 | **Import Flows** | GitHub/Figma/ZIP se import | ❌ UI only |
| 13 | **Publishing** | App deploy karo | ⚠️ Planned |

---

## 5. TECH STACK

| Layer | Technology |
|---|---|
| **Frontend** | React 18, TypeScript, Vite, TanStack Query, Wouter, Tailwind CSS, Radix UI |
| **Code Editor** | Monaco Editor (VS Code engine) |
| **Backend** | Node.js, Express, TypeScript, tsx runtime |
| **Database** | PostgreSQL + Drizzle ORM |
| **AI / LLM** | OpenRouter API (default: `openai/gpt-oss-120b:free`) |
| **Realtime** | SSE (Server-Sent Events) + WebSocket |
| **Memory** | Vector DB abstraction (chunking + embedding + retrieval) |
| **Queue** | BullMQ (Redis-backed, null fallback active) |
| **Process Mgmt** | Custom RuntimeManager + child_process |

---

## 6. ENVIRONMENT VARIABLES

| Variable | Zaruri? | Kaam |
|---|---|---|
| `OPENROUTER_API_KEY` | ✅ AI ke liye | LLM API key |
| `DATABASE_URL` | ✅ Persistence ke liye | PostgreSQL connection |
| `AGENT_PROJECT_ROOT` | Recommended | Sandbox root path |
| `LLM_MODEL` | Optional | Model override |
| `REDIS_URL` | Optional | Queue (null fallback hai) |

---

## 7. SYSTEM ARCHITECTURE (Overview)

```
User Browser
    ↓
React / Vite UI (port 5000)
    ├── Chat Panel
    ├── File Explorer + Monaco Editor
    ├── Preview iframe
    ├── Terminal / Console
    └── Projects / Settings Pages
    ↓  HTTP / SSE / WebSocket
Express API Server (port 3001)
    ├── Chat + Run Lifecycle
    ├── Orchestration Engine
    ├── 9 AI Agents
    ├── 158 Registered Tools
    ├── File Explorer Module
    ├── Terminal Module
    ├── Preview / Runtime Module
    └── Memory Platform
    ↓
PostgreSQL + Filesystem Sandbox
```

---

## 8. DATA MODEL (Key Tables)

| Table | Kya Store Hota Hai |
|---|---|
| `projects` | Workspace rows (name, sandboxPath, status) |
| `agent_runs` | Har AI run ka lifecycle record |
| `chat_messages` | User + agent + tool messages |
| `tool_executions` | Har tool call ka detailed log |
| `checkpoints` | File state snapshots |
| `rollback_history` | Rollback audit trail |
| `deployments` | Deployment metadata |
| `console_logs` | Runtime terminal output |
