# Nura-X Deployer

An autonomous "Agentic AI Vibe Coder" platform that builds, runs, and manages web applications based on natural language instructions. It provides a sandboxed environment where AI agents collaborate to plan, write, test, and deploy code, with a real-time monitoring interface.

## Architecture

- **Frontend** (`client/`): React + Vite + TypeScript + Tailwind CSS + Radix UI. IDE-like interface with file explorer, terminal, chat, and preview window.
- **Backend** (`server/`): Express + Node.js + TypeScript. Manages AI orchestration, project sandboxes, and runtime services.
- **Shared** (`shared/`): Drizzle ORM schema shared between frontend and backend.
- **AI Engine**: Multi-agent architecture (Planner, Executor, Browser, Security) via OpenRouter.

## Running the Project

The workflow `Start application` runs `npm run dev`, which starts:
- Backend API on port **3001** (`tsx watch main.ts`)
- Frontend on port **5000** (`vite`)

## Key Environment Variables

| Variable | Purpose |
|---|---|
| `OPENROUTER_API_KEY` | LLM API key for agent runs |
| `DATABASE_URL` | PostgreSQL connection string (auto-provided by Replit) |
| `LLM_MODEL` | Model to use (default: `openai/gpt-oss-120b:free`) |
| `LLM_BASE_URL` | OpenRouter base URL |
| `AGENT_PROJECT_ROOT` | Sandbox directory (default: `.sandbox`) |

## Database

PostgreSQL via Drizzle ORM. Schema in `shared/schema.ts`. Run migrations with:
```
npx drizzle-kit push
```

## User Preferences

- Keep files under 250 LOC — split intelligently
- High cohesion, low coupling — single responsibility per module
- Fail-closed: no silent failures, no swallowed errors
- Telemetry on all significant operations via the EventBus
- Typed contracts everywhere — no `any` unless unavoidable
