# Tool Registry Spec

> How NURAX's 158+ tools are defined, registered, sealed, and dispatched — the single interface through which all agents interact with the outside world.

---

## Philosophy

Agents in NURAX are **read-only orchestrators**. They never call `fs`, `child_process`, `fetch`, or any browser API directly. Every side effect goes through the Tool Registry via a single `dispatch(toolName, args, context)` call. This gives the system:

- **Auditability** — every tool call is logged with metrics
- **Security** — permissions and allow-lists enforced in one place
- **Testability** — tools can be mocked at the registry boundary
- **Observability** — timeouts, retries, and errors surface uniformly

---

## Boot-Time Registration Flow

Tools are registered **once, at startup**. The sequence is:

```
main.ts → loadAllTools()
              ├── registerFilesystemTools()   →  40+ tools
              ├── registerCodingTools()        →  47 tools
              ├── registerTerminalTools()      →  27 tools
              ├── registerVerifierTools()      →  12 tools
              ├── registerBrowserTools()       →  27 tools
              └── registerGitTools()           →   5 tools
                                              ─────────────
                                               158 tools total
              └── sealRegistry()              ← no more registration allowed
```

**File:** `server/tools/registry/tool-loader.ts`

After `sealRegistry()` sets the `_sealed` flag, any further `registerTool()` or `unregisterTool()` call throws a `ToolRegistryError`. This prevents runtime injection of rogue tools.

---

## Tool Definition Shape

```typescript
interface ToolDefinition {
  name: string;                     // unique identifier, e.g. "readFile"
  category: ToolCategory;           // 'filesystem' | 'coding' | 'terminal' | 'verifier' | 'browser' | 'git'
  description: string;              // human-readable purpose
  inputSchema: ZodSchema;           // validated before handler is called
  handler: (args, context) => Promise<ToolResult>;
  permissions?: Permission[];       // optional — restricts which agents may call
  timeout?: number;                 // ms, default varies by category
}
```

**File:** `server/tools/registry/tool-types.ts`

---

## Categories & Tools

### 🗂 Filesystem (40+ tools)

**Registry file:** `server/tools/filesystem/registry/register-filesystem-tools.ts`

| Tool | Purpose |
|---|---|
| `readFile` | Read file content with optional line range |
| `writeFile` | Atomic write (creates intermediate dirs) |
| `patchFile` | Apply targeted string replacements |
| `deleteFile` | Remove a single file |
| `searchRegex` | Ripgrep-style regex search across files |
| `scanFolder` | Recursive directory listing with filters |
| `createFolder` | Create directory tree |
| `moveFile` | Rename / relocate with conflict check |
| `copyFile` | Duplicate file or directory |
| `getFileMetadata` | Size, modified time, mime type |
| `diffFiles` | Unified diff between two paths |
| `watchFile` | Register a change listener (chokidar) |
| … | 28+ more operations |

### 💻 Coding (47 tools)

**Registry file:** `server/tools/coding/registry/register-coding-tools.ts`

High-level generation tools that call the CodeGen LLM and write structured output. Organised by domain:

| Domain | Example tools |
|---|---|
| React / Frontend | `generateReactPage`, `generateReactComponent`, `generateLayout` |
| Express / Backend | `generateExpressRoute`, `generateMiddleware`, `generateController` |
| API | `generateRestApi`, `generateOpenApiSpec` |
| Auth | `generateJwtAuth`, `generateSessionAuth`, `generateOAuthFlow` |
| Database | `generateSchema`, `generateMigration`, `generateSeedData` |
| CRUD | `generateCrudModule`, `generateRepository`, `generateService` |
| Styling | `generateTailwindTheme`, `generateCssModule` |

### 🖥 Terminal (27 tools)

**Registry file:** `server/tools/terminal/registry/terminal-tool-registry.ts`

All shell access is gated through this category. Commands run scoped to `sandboxRoot`.

| Tool | Purpose |
|---|---|
| `executeCommand` | Run arbitrary shell command (allow-listed) |
| `installPackage` | `npm install <pkg>` with lock-file update |
| `npmRunScript` | Execute a script from `package.json` |
| `startRuntime` | Spawn a long-running dev server |
| `killProcess` | SIGTERM → SIGKILL a managed process |
| `ls` / `cd` / `pwd` | Navigation helpers |
| `getProcessList` | List managed processes and their status |
| `checkPort` | Is a port currently in use? |
| … | 18+ more helpers |

### ✅ Verifier (12 tools)

**Registry file:** `server/tools/verifier/register-verifier-tools.ts`

| Tool | Purpose |
|---|---|
| `runTypecheck` | `tsc --noEmit`, returns structured error list |
| `runBuild` | Vite/esbuild build, captures warnings |
| `runTests` | Execute test suite, parse results |
| `checkServerHealth` | HTTP health-check against running server |
| `analyzeErrors` | Classify and prioritise error list |
| `detectRuntimeCrash` | Parse logs for crash signatures |
| `lintCode` | ESLint with auto-fix support |
| `validateSchema` | Zod / JSON Schema validation |

### 🌐 Browser (27 tools)

**Registry file:** `server/tools/browser/register-browser-tools.ts`

Playwright-backed automation running against the preview server.

| Tool | Purpose |
|---|---|
| `browserLaunch` | Start headless Chromium instance |
| `browserNavigate` | Go to URL, wait for load |
| `browserClick` | Click element by selector |
| `browserFill` | Type into input field |
| `browserSelect` | Choose dropdown option |
| `browserScreenshot` | Capture viewport as PNG |
| `browserCaptureUiState` | Extract DOM state as structured JSON |
| `browserGetConsoleErrors` | Collect JS console errors |
| `browserWaitForElement` | Wait for selector to appear |
| … | 18+ more interactions |

### 🔀 Git (5 tools)

**Registry file:** `server/tools/git/register-git-tools.ts`

| Tool | Purpose |
|---|---|
| `gitStatus` | Working tree status |
| `gitDiff` | Diff staged or unstaged changes |
| `gitAdd` | Stage files |
| `gitCommit` | Commit with message |
| `gitLog` | Recent commit history |

---

## Dispatcher

**File:** `server/tools/registry/tool-dispatcher.ts`

The `dispatch()` function is the **only** way agents call tools:

```typescript
const result = await dispatch(toolName, args, executionContext);
```

What dispatch does, in order:

1. **Lookup** — `getTool(toolName)` from the sealed registry (throws if unknown)
2. **Permission check** — validates the calling agent has access
3. **Input validation** — runs `tool.inputSchema.parse(args)` via Zod
4. **Timeout wrap** — wraps handler in a `Promise.race` with configured timeout
5. **Execute** — calls `tool.handler(validatedArgs, context)`
6. **Metrics** — records call duration, success/failure, tool name, runId
7. **Return** — `ToolResult { ok: boolean, data?: any, error?: string }`

---

## Adding a New Tool

1. Define the tool as a `ToolDefinition` object in the appropriate category folder
2. Add it to that category's registration function
3. Re-run the server — it will appear in the sealed registry at boot
4. Tools are available to all agents immediately after sealing

> Never call `registerTool()` at runtime after `sealRegistry()` — it will throw.
