---
name: Browser Agent structure
description: server/agents/browser/ is the pure agent core; server/tools/browser/ owns all implementations + tool registrations
---

## Rule
`server/agents/browser/` = 22 files, 7 folders — PURE agent only:
- `core/` (browser-agent, browser-session, browser-state, navigation-engine)
- `types/`, `events/`, `telemetry/`, `reporting/`, `utils/`, `index.ts`

`server/tools/browser/` = 60 files — ALL implementations + ToolDefinition wrappers:
- `capture/`, `interaction/`, `navigation/`, `validation/`, `monitoring/`
- Implementations have `../../../agents/browser/types|utils|events|telemetry` imports (3 levels up)
- agents/browser/core/ imports tools with `../../../tools/browser/` (3 levels up)

**Why:** Moved 15 implementation files (capture, interaction, navigation, validation, monitoring) from agents/ to tools/ so agents/ contains only orchestration logic.

**How to apply:** Never add implementation files (Playwright page ops, DOM manipulation) into agents/browser/. Those belong in tools/browser/. The only agents/ additions allowed are core orchestration changes.
