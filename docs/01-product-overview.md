# Product Overview

## Evidence policy

- **FACT**: Verified directly from source code, configuration, or tests in this repository.
- **INFERRED**: Derived from multiple implementation facts where the code does not state the product intent explicitly.
- **ASSUMPTION**: Plausible product intent that is not fully implemented or not provable from code.

## What the product is

**FACT**: NURAX is a full-stack agentic application builder and runtime workspace. The repo contains a React/Vite frontend, an Express/TypeScript API server, a PostgreSQL schema managed with Drizzle, an agent orchestration layer, a tool registry, sandbox filesystem tooling, terminal/runtime management, preview proxying, checkpoints, chat, memory, and UI surfaces for projects, imports, publishing, usage, integrations, console, preview, and workspace.

**FACT**: The runnable entrypoint is `main.ts`. It boots infrastructure, memory, tools, preview, HTTP routes, chat WebSockets, orchestration, file watchers, and runtime routes in a fixed order.

**FACT**: The package name is `nura-x-deployer`, but implemented behavior is broader than deployment: chat-driven code generation, project workspaces, file exploration, terminal sessions, preview lifecycle, runtime execution, and deployment-related data models exist.

**INFERRED**: The intended product category is similar to a browser-based AI software creation environment: users describe an app idea, the agent plans and edits files in a sandbox, the system runs/verifies the app, and the user previews the result.

## Core problem solved

**FACT**: The application lets users create projects, submit natural-language goals to an agent run, observe lifecycle/tool events, inspect/edit sandbox files, run terminal commands, start or restart a sandbox runtime, and preview the resulting app.

**INFERRED**: The core problem is reducing the path from product idea to runnable web application by combining conversation, autonomous coding agents, sandboxed tool execution, runtime preview, and recovery/verification flows in one UI.

## Target users

**FACT**: The UI includes non-code entry points such as home, create project, import options, workspace chat, preview, publishing, integrations, and usage pages.

**INFERRED**: Target users include:

1. Founders/product builders who want to describe app ideas and receive a working prototype.
2. Developers who want AI-assisted file edits, terminal execution, preview, checkpoints, and debugging.
3. Operators/admins who need usage, integrations, publishing, and runtime status views.
4. AI agents or automation workflows that need stable HTTP/SSE contracts for runs, tools, and runtime status.

## Core value proposition

**INFERRED**: NURAX aims to provide a Replit/Bolt/Cursor-style web workspace where the user says what to build and the platform handles planning, code generation, filesystem changes, runtime execution, verification, and preview feedback.

## Implemented product boundaries

**FACT**: Implemented, mounted capabilities include:

- Project CRUD subset: list/create/get/update.
- In-memory folders API.
- Chat/run APIs mounted under `/api`.
- Shared realtime SSE at `/api/realtime`.
- Orchestration diagnostics/run API under `/api/orchestration`.
- Terminal API under `/api/terminal`.
- File explorer API under `/api/file-explorer` plus legacy aliases under `/api`.
- Preview API under `/api/preview`.
- Runtime start/restart/stop under `/api/runtime/:projectId/*`.
- Preview frame proxy under `/preview/frame`.

**FACT**: Several UI pages call APIs that are not mounted in `main.ts`, including import endpoints such as `/api/import/git`, `/api/import/figma`, `/api/import/base44`, `/api/import/zip`, `/api/import/status/:id`, and metrics endpoint `/api/agents/metrics`.

## Current readiness statement

**INFERRED**: The system is an ambitious but partially integrated agentic IDE. The architecture contains many intended layers, but production readiness is limited by incomplete API surfaces, missing route implementations for visible UI flows, incomplete default test coverage, large build-output warnings, and incomplete persistence/recovery around some subsystems.
