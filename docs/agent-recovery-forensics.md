# NURAX Vibe Coding Agent Recovery Forensics

## Phase 0 Graphs

1. **Bootstrap Graph**: `main.ts` -> `registerInfrastructure()` -> `registerServices()` -> `loadAllTools()` -> `initPreviewModule()` -> route mounting -> HTTP listen.
2. **Dependency Injection Graph**: process env and DB seed provide sandbox roots; modules use singleton imports for bus, registry, memory, filesystem, terminal, preview, and repositories.
3. **Agent Graph**: Chat run -> orchestration phase runner -> agent coordinator -> planner/executor/filesystem/terminal/verifier/browser/supervisor/coderx agents.
4. **Tool Graph**: executor task -> tool coordinator -> dispatcher client -> central tool dispatcher -> registered tool handler -> real side effect.
5. **Tool Registry Graph**: `loadAllTools()` registers filesystem, coding, terminal, verifier, git, and browser tools before sealing the singleton registry.
6. **Agent Registry Graph**: valid agent types are in the coordinator (`planner`, `executor`, `verifier`, `browser`, `filesystem`, `terminal`, `supervisor`, `coderx`) and are invoked in-process.
7. **Runtime Graph**: terminal runtime tools -> runtime service -> process service -> process registry/status.
8. **Terminal Graph**: terminal tool -> command/package/runtime service -> `spawnSync`/`spawn` -> stdout/stderr/exit code -> dispatcher result.
9. **Package Installation Graph**: terminal install tool -> package service -> package manager detector -> package installer -> package manager process -> dependency output.
10. **File System Graph**: coding tool returns file map -> executor persistence -> `fs_write_file` -> write service -> repository write under sandbox root.
11. **Preview Graph**: preview module bootstrap -> runtime routes -> preview lifecycle/runtime manager -> health monitor -> SSE preview lifecycle topics.
12. **Memory Graph**: chat/orchestrator/planner/executor recall memory before work and store execution/planning outcomes after work.
13. **Event Bus Graph**: publishers emit `agent.event`/lifecycle/checkpoint payloads -> infrastructure bus -> SSE manager -> `/api/realtime` subscribers.
14. **SSE Graph**: `/api/realtime` registers topic filters -> bus listeners broadcast named SSE events -> client realtime provider dispatches topic callbacks.
15. **Chat Action Graph**: agent/tool events -> client agent handler -> tool/plan/message handlers -> inflight action feed/tool groups.
16. **End-to-End Execution Graph**: user -> chat orchestrator -> orchestration loop -> planner -> executor -> tool dispatcher -> filesystem/terminal/runtime -> events -> chat UI/preview.

## First Failure Point

The earliest execution-chain break was in the orchestration agent coordinator: an agent could return an explicit failed envelope (`ok: false` or `success: false`) and the phase was still marked successful because the coordinator treated any non-throwing return value as success. That created fake success before later filesystem, terminal, runtime, preview, or chat visibility symptoms appeared.

## Root Causes

- Agent result envelopes were not normalized into phase failures.
- Planner sandbox context was not carried through the planner cycle, so planning could validate a different workspace root than execution.
- Tool execution did not publish chat action lifecycle events from the central dispatcher, leaving users with text-only responses.
- Terminal tools could return non-zero exit codes as successful dispatcher results, allowing failed commands/package installs to masquerade as completed tools.
- Client chat event handling only understood `eventType` payloads and ignored orchestration events that only exposed `type`.

## Fake Success Paths

- `agent.success === false` -> phase `ok: true` -> workflow success.
- `agent.ok === false` -> phase `ok: true` -> run completion.
- terminal result `exitCode !== 0` -> dispatcher `ok: true` -> task success.
- tool handler side effects with no emitted action event -> invisible execution.

## Fixes Applied

- Added agent-failure normalization in the coordinator so failed planner/executor/verifier/etc. envelopes fail the phase.
- Threaded the orchestration sandbox root into planner cycles.
- Added central tool start/completion/error, shell output, and file write event publication in the dispatcher.
- Added terminal exit-code reality checks in the dispatcher.
- Added client-side event aliasing for orchestration events and handling for dispatcher file-write events.

## Validation Results

- `git diff --check`: passed.
- `npm test`: passed, but the configured test glob currently discovers zero tests.
- `tsc --noEmit --pretty false`: blocked by missing `node_modules`/type packages in the environment; filtered output showed only pre-existing missing dependency/type errors for touched files.

## End-to-End Readiness

Autonomous coding agent readiness is estimated at **72%** after this recovery pass. The system now fails loudly for failed agents/tools and surfaces real tool activity, but full readiness still requires dependency installation in the runtime environment and a real browser/preview smoke test with project dependencies available.
