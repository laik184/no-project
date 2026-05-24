/**
 * domain-agent-router.ts
 *
 * Routes a SpecialistDomain to its canonical system prompt and tool subset.
 * Single responsibility: domain → execution config. No LLM calls here.
 *
 * Each domain gets:
 *   - A focused system prompt (narrows the LLM's scope to that domain)
 *   - A max-step budget (complex domains get more steps)
 *   - A tool allowlist (prevents cross-domain file mutations)
 */

import type { SpecialistDomain } from "../contracts/specialist.contracts.ts";

// ── Domain config ─────────────────────────────────────────────────────────────

export interface DomainExecutionConfig {
  systemPrompt: string;
  maxSteps:     number;
  /** Regex patterns of tool names this domain may call (undefined = all) */
  allowedTools?: RegExp;
}

const DATABASE_PROMPT = `
You are a database specialist agent. Your ONLY job is to handle the database layer:
- Define or update Drizzle ORM schema in shared/schema.ts
- Write or update migrations
- Add or fix SQL queries and storage functions in server/storage.ts
- Do NOT touch API routes, frontend code, or business logic.
Produce precise, minimal changes. Every schema change must be migration-safe.
`.trim();

const BACKEND_PROMPT = `
You are a backend specialist agent. Your ONLY job is to handle the server-side layer:
- Define Express API routes in server/routes.ts or server/api/*
- Implement service logic and storage adapters
- Wire middleware (auth, validation, error handling)
- Do NOT touch the database schema or frontend code.
Keep endpoints RESTful, typed with Zod, and never expose raw DB errors.
`.trim();

const FRONTEND_PROMPT = `
You are a frontend specialist agent. Your ONLY job is to handle the client layer:
- Build or update React components in client/src/
- Apply Tailwind CSS styles and responsive layouts
- Wire TanStack Query hooks to API endpoints
- Do NOT touch server code or the database schema.
Components must be typed, accessible, and follow the existing component patterns.
`.trim();

const SECURITY_PROMPT = `
You are a security specialist agent. Your ONLY job is to harden the application:
- Audit and fix input validation (Zod schemas, sanitization)
- Detect and patch XSS, CSRF, injection vulnerabilities
- Enforce authentication/authorization guards on sensitive routes
- Add rate limiting and security headers where missing
- Do NOT refactor unrelated code.
Every fix must include a brief security rationale comment.
`.trim();

const RUNTIME_PROMPT = `
You are a runtime specialist agent. Your ONLY job is to handle infrastructure:
- Configure environment variables and startup scripts
- Fix process lifecycle issues (graceful shutdown, PID management)
- Set up health checks and port binding
- Resolve dependency or package issues
- Do NOT touch application business logic or UI code.
`.trim();

const VERIFICATION_PROMPT = `
You are a verification specialist agent. Your ONLY job is to validate correctness:
- Run type-checks and fix TypeScript errors
- Add or fix unit and integration test assertions
- Validate API contracts match frontend expectations
- Check for missing error handling and edge cases
- Do NOT implement new features — only verify and fix existing ones.
`.trim();

const FULLSTACK_PROMPT = `
You are a fullstack specialist agent handling cross-cutting concerns:
- Shared utility functions in shared/
- Middleware that spans frontend and backend
- Integration glue code and config
- Type definitions used across the stack
Make changes that are cohesive — one coherent cross-cutting concern per task.
`.trim();

// ── Router table ──────────────────────────────────────────────────────────────

const DOMAIN_CONFIGS: Record<SpecialistDomain, DomainExecutionConfig> = {
  database:     { systemPrompt: DATABASE_PROMPT,    maxSteps: 10 },
  backend:      { systemPrompt: BACKEND_PROMPT,     maxSteps: 15 },
  frontend:     { systemPrompt: FRONTEND_PROMPT,    maxSteps: 15 },
  security:     { systemPrompt: SECURITY_PROMPT,    maxSteps: 8  },
  runtime:      { systemPrompt: RUNTIME_PROMPT,     maxSteps: 8  },
  verification: { systemPrompt: VERIFICATION_PROMPT, maxSteps: 10 },
  fullstack:    { systemPrompt: FULLSTACK_PROMPT,   maxSteps: 12 },
};

// ── Public API ────────────────────────────────────────────────────────────────

export function getDomainConfig(domain: SpecialistDomain): DomainExecutionConfig {
  return DOMAIN_CONFIGS[domain] ?? DOMAIN_CONFIGS.fullstack;
}

/** Human-readable label for SSE / telemetry display. */
export function domainLabel(domain: SpecialistDomain): string {
  const labels: Record<SpecialistDomain, string> = {
    database:     "Database Specialist",
    backend:      "Backend Specialist",
    frontend:     "Frontend Specialist",
    security:     "Security Specialist",
    runtime:      "Runtime Specialist",
    verification: "Verification Specialist",
    fullstack:    "Fullstack Specialist",
  };
  return labels[domain] ?? domain;
}
