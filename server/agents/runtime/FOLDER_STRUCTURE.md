# server/agents/runtime/ — Deep Scan & Folder Structure

Yeh folder **Runtime Agent** ka core hai. Iska kaam hai — sandbox ke andar shell commands chalana,
npm packages install karna, processes manage karna, aur unka real-time output frontend tak stream karna.

---

## Folder Tree

```
server/agents/runtime/
├── index.ts                      ← Public API (sab kuch yahan se export hota hai)
├── command-validator.ts          ← Command safety check karta hai chalane se pehle
├── shell-executor.ts             ← Actual shell command spawn karta hai
├── process-stream.ts             ← Real-time streaming ke saath command chalata hai
├── stream-buffer.ts              ← Output bytes buffer karta hai (10MB cap)
├── output-streamer.ts            ← Stream output ko SSE/Event bus se jodata hai
├── npm-manager.ts                ← npm install / run / package.json likhna manage karta hai
├── process-manager.ts            ← Chalte processes ka registry maintain karta hai
├── runtime-monitor.ts            ← Har run ki health track karta hai (pass/fail rate)
└── validation/
    └── output-validator.ts       ← Generated code aur command output validate karta hai
```

---

## Har File Ka Kaam (Detail Mein)

---

### 1. `index.ts` — Public API Gateway

**Kya karta hai:**
Is folder ka **entry point** hai. Baaki sab files ke exports yahan se bahar jaate hain.
Koi bhi file jo runtime agent use karna chahe, woh sirf `server/agents/runtime` se import karti hai,
seedha andar nahi jaati.

**Exports karta hai:**
| Export | Kahan se |
|--------|----------|
| `shellExecutor` | shell-executor.ts |
| `npmManager` | npm-manager.ts |
| `processManager` | process-manager.ts |
| `runtimeMonitor` | runtime-monitor.ts |
| `executeWithStreaming` | output-streamer.ts |
| `validateCommand` | command-validator.ts |
| `ShellResult` (type) | shell-executor.ts |
| `RuntimeHealth` (type) | runtime-monitor.ts |

---

### 2. `command-validator.ts` — Command Safety Guard

**Kya karta hai:**
Koi bhi shell command chalane se **pehle** check karta hai ke woh allowed hai ya nahi.
Agar command unsafe hai toh error throw karta hai. Yeh ek whitelist-based security layer hai.

**Allowed Commands:**
| Command | Allowed Subcommands |
|---------|-------------------|
| `npm` | install, run, test, build, ci, ls, audit |
| `npx` | (kuch bhi — unrestricted) |
| `pnpm` | install, run, add, remove, build, test |
| `node` | (kuch bhi) |
| `tsc` | --build, --watch, --noEmit, --version |
| `tsx` | (kuch bhi) |
| `git` | status, log, diff, show (read-only only!) |
| `ls`, `mkdir`, `echo`, `cat` | limited flags |

**Helper Functions:**
- `validateCommand(command)` → parsed `{executable, args, raw}` return karta hai ya error throw karta hai
- `isNpmInstall(command)` → true/false — kya yeh `npm install` hai?
- `isNpmRun(command)` → true/false — kya yeh `npm run <script>` hai?

**Ek doosri file se bhi check karta hai:**
`server/agents/filesystem/validation/command-safety.ts` — deeper safety scan ke liye.

---

### 3. `shell-executor.ts` — Core Shell Spawner

**Kya karta hai:**
Validated commands ko actually **child process** ke roop mein spawn karta hai.
Stdout/stderr collect karta hai, timeout handle karta hai, aur result return karta hai.

**Do methods hain:**

#### `execute(command, cwd, timeoutMs)`
- Direct command chalata hai given directory mein
- Default timeout: **30 seconds**
- `shell: false` use karta hai (safer — no shell injection)
- Return: `{ stdout, stderr, exitCode, durationMs }`

#### `executeInSandbox(runId, projectId, command, timeoutMs)`
- Pehle `workspaceManager.getRoot(projectId)` se sandbox path dhundhta hai
- Phir `execute()` call karta hai usi path par
- Non-zero exit code par warning log karta hai

**Security:** `shell: false` — matlab command directly spawn hoti hai, koi `/bin/sh -c` nahi.
Isse shell injection attacks nahi ho sakte.

---

### 4. `process-stream.ts` — Real-Time Streaming Spawner

**Kya karta hai:**
`shell-executor.ts` se zyada advanced version. Command chalata hai lekin output ko
**real-time chunks** mein emit karta hai via callbacks — wait nahi karta sab khatam hone ka.

**Kab use hota hai:**
Jab frontend ko live terminal output dikhana ho (jaise `npm install` chal raha ho aur output aa raha ho).

**Flow:**
1. `validateCommand()` se command check karta hai
2. `StreamBuffer` instances banata hai stdout aur stderr ke liye
3. `spawn()` karta hai process — data aate hi callbacks fire hote hain
4. Timeout par `SIGTERM` bhejta hai
5. Close par complete `StreamResult` return karta hai

**Return karta hai:**
```typescript
{
  stdout: string,     // full collected output
  stderr: string,     // full collected errors
  exitCode: number,
  durationMs: number,
  truncated: boolean  // kya 10MB cap lagi?
}
```

---

### 5. `stream-buffer.ts` — Output Buffer Class

**Kya karta hai:**
Streaming process output ko **safely accumulate** karta hai memory mein.
10MB hard cap hai taake memory leak na ho. Saath mein real-time callback bhi support karta hai.

**Class: `StreamBuffer`**

| Method/Property | Kaam |
|----------------|------|
| `push(data)` | Naya chunk add karo (Buffer ya string) |
| `text` (getter) | Poora accumulated output as string |
| `byteSize` (getter) | Kitne bytes ab tak |
| `isCapped` (getter) | Kya 10MB limit aa gayi? |
| `tail(chars)` | Last N characters — LLM context ke liye useful |
| `clear()` | Buffer reset karo |

**Default max:** 10 MB (`10 * 1024 * 1024` bytes)

---

### 6. `output-streamer.ts` — Event Bus Bridge

**Kya karta hai:**
`process-stream.ts` aur **executor event bus** ke beech mein bridge ka kaam karta hai.
Har line jo command output kare, woh SSE event bann jaati hai jo frontend ko real-time mein milti hai.

**Function: `executeWithStreaming(runId, taskId, stepId, command, opts)`**

**Flow:**
1. `runStreaming()` call karta hai `process-stream.ts` se
2. Har output chunk ko line-by-line split karta hai
3. Har line ke liye `executorBus.emit('execution.step.started', ...)` fire karta hai
4. Frontend SSE ke zariye yeh events receive karta hai (live terminal effect)
5. Completion par `executorLogger.info()` se summary log karta hai

**Return:** `StreamedExecutionResult` — `StreamResult` + `command` + `runId`

---

### 7. `npm-manager.ts` — NPM Operations Manager

**Kya karta hai:**
NPM se related saari operations ek jagah manage karta hai — packages install karna,
scripts chalana, aur nayi projects ke liye `package.json` likhna.

**Security Feature — Package Blocklist:**
Yeh packages install nahi karne deta:
```
child_process, fs, vm, cluster, worker_threads
```
(Yeh Node.js native modules hain jo sandbox escape kar sakte hain)

**Teen methods hain:**

#### `install(runId, projectId, packages[], dev)`
- Package list validate karta hai blocklist ke against
- `npm install [packages] [--save-dev]` chalata hai sandbox mein
- Timeout: **120 seconds** (npm install slow ho sakta hai)

#### `runScript(runId, projectId, script, timeoutMs)`
- `npm run <script>` chalata hai
- Default timeout: 60 seconds

#### `writePackageJson(runId, projectId, name, deps, devDeps)`
- Standard `package.json` template likhta hai sandbox mein
- Default scripts: `{ dev: 'node index.js', build: 'tsc' }`
- `fileWriter.write()` use karta hai directly likhne ke liye

---

### 8. `process-manager.ts` — Process Registry

**Kya karta hai:**
Sabhi **chalte processes ka record** rakhta hai ek in-memory registry mein.
Processes register hoti hain jab start honti hain, aur unka status update hota hai jab stop/crash honti hain.

**Type: `ProcessStatus`** = `'running' | 'stopped' | 'crashed'`

**Interface: `ManagedProcess`**
```typescript
{
  id: string,        // unique process ID
  runId: string,     // kis run ka hissa hai
  command: string,   // kya command chali
  pid: number,       // OS process ID
  status: ProcessStatus,
  startedAt: Date,
  stoppedAt?: Date
}
```

**Methods:**
| Method | Kaam |
|--------|------|
| `register(id, runId, command, pid)` | Nayi process registry mein daalo |
| `markStopped(id)` | Status `stopped` karo |
| `markCrashed(id)` | Status `crashed` karo |
| `get(id)` | Ek process dhundho by ID |
| `listByRun(runId)` | Ek run ki saari processes |
| `listRunning()` | Sirf abhi chalti processes |
| `clearRun(runId)` | Poore run ki saari processes hatao |

---

### 9. `runtime-monitor.ts` — Health Tracker

**Kya karta hai:**
Har **run ki health monitor** karta hai — kitne steps pass hue, kitne fail hue,
aur overall failure rate calculate karta hai. Agar failure rate 50% se zyada ho jaaye
toh run "unhealthy" mark ho jaata hai.

**Interface: `RuntimeHealth`**
```typescript
{
  runId: string,
  stepsTotal: number,
  stepsPassed: number,
  stepsFailed: number,
  healthy: boolean,      // failureRate < 50%
  failureRate: number    // 0.0 to 1.0
}
```

**Methods:**
| Method | Kaam |
|--------|------|
| `init(runId, stepsTotal)` | Run ke liye health tracker shuru karo |
| `recordStep(runId, success)` | Ek step ka result record karo |
| `getHealth(runId)` | Poori health info lo |
| `isHealthy(runId)` | Bas true/false — healthy hai? |
| `clear(runId)` | Run khatam hone par cleanup |

**Alert:** Agar failure rate 50% cross kare toh `executorLogger.warn()` fire hoti hai.

---

### 10. `validation/output-validator.ts` — Output Quality Checker

**Kya karta hai:**
Do cheezein validate karta hai:
1. **Generated code** — kya AI ne kuch likha bhi ya empty string di?
2. **Command output** — kya command successfully chali (exit code 0)?

#### `validateGeneratedCode(stepType, content)`
Yeh step types ke liye content check karta hai:
`generate_frontend`, `generate_backend`, `generate_api`, `generate_database`,
`generate_auth`, `generate_component`, `write_file`, `edit_file`

- Content empty hai → **ERROR**
- Content 10 characters se kam → **WARNING** (suspiciously short)

#### `validateCommandOutput(exitCode, stdout, stderr)`
- Exit code non-zero → **ERROR** + stderr message
- stdout mein "error" word + non-zero exit → **WARNING**

**Return type:**
```typescript
{
  valid: boolean,
  errors: string[],
  warnings: string[]
}
```

---

## Data Flow Diagram

```
User Request (Chat/API)
        │
        ▼
  command-validator.ts   ← "Yeh command safe hai?"
        │
        ├──► shell-executor.ts        ← Simple run (wait for complete)
        │
        └──► process-stream.ts       ← Streaming run (real-time output)
                    │
                    ▼
             stream-buffer.ts        ← Output ko memory mein buffer karo
                    │
                    ▼
            output-streamer.ts       ← Har line → executorBus event → SSE → Frontend
                    │
                    ▼
            runtime-monitor.ts       ← Step result record karo (pass/fail)
                    │
                    ▼
         validation/output-validator.ts ← Code/output quality check karo


npm-manager.ts ────► shell-executor.ts  (npm commands ke liye wrapper)
process-manager.ts ─► In-memory registry (chalte processes track karo)
```

---

## Summary Table

| File | Responsibility | Exports |
|------|---------------|---------|
| `index.ts` | Public API gateway | Sab kuch |
| `command-validator.ts` | Whitelist-based command safety | `validateCommand`, `isNpmInstall`, `isNpmRun` |
| `shell-executor.ts` | Child process spawn + wait | `shellExecutor`, `ShellResult` |
| `process-stream.ts` | Child process spawn + real-time stream | `runStreaming` |
| `stream-buffer.ts` | Memory-safe output accumulator | `StreamBuffer` |
| `output-streamer.ts` | Stream → Event bus bridge | `executeWithStreaming` |
| `npm-manager.ts` | npm install/run/package.json | `npmManager` |
| `process-manager.ts` | Running process registry | `processManager` |
| `runtime-monitor.ts` | Per-run health tracking | `runtimeMonitor`, `RuntimeHealth` |
| `validation/output-validator.ts` | Code & command output validation | `validateGeneratedCode`, `validateCommandOutput` |
