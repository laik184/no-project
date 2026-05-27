# Executor Gap Report — Tumhara vs Replit Agent

> **Date:** 27 May 2026  
> **Scope:** `server/agents/executor/` — kya hai, kya missing hai, aur priority order

---

## 🔴 CRITICAL — Sabse Important Missing Cheezein

---

### 1. LLM Tool-Calling Loop Nahi Hai ← Sabse Bada Gap

Replit Agent ka executor ek real **LLM tool-calling loop** chalata hai:

1. LLM ko task + context deta hai
2. LLM decide karta hai kaunsa tool call karna hai (`write_file`, `run_command`, etc.)
3. Tool ka result wapis LLM ko deta hai
4. LLM phir decide karta hai aage kya karna hai
5. Yeh loop tab tak chalta hai jab tak task complete na ho

**Tumhara executor:** Static plan → fixed steps mapping (`task-interpreter.ts`).  
LLM execution ke dauran koi decision nahi karta. Ek `setup` task → hamesha sirf `npm_install` step.  
**No dynamic intelligence during execution.**

```
Replit Agent:  Task → LLM Loop → [tool call → result → LLM → tool call → ...] → Done
Tumhara:       Task → task-interpreter.ts → fixed steps [] → run in order → Done
```

---

### 2. `edit_file` Sirf Append Karta Hai ← Broken Feature

```ts
// step-runner.ts line 101–107
case 'edit_file': {
  await fileEditor.append(projectId, input.filePath, input.fileContent); // ← SIRF APPEND!
}
```

Replit Agent ka edit: **old_string → new_string** surgical replacement karta hai.  
Tumhara `edit_file` step existing file mein sirf text add karta hai neeche — existing code modify nahi kar sakta.  
**Iska matlab: agent koi bug fix ya refactor nahi kar sakta.**

**Missing fields in `StepInput` type:**
```ts
// yeh fields nahi hain tumhare types/execution.types.ts mein:
oldString?: string;  // exact string jo replace karni hai
newString?: string;  // replacement string
```

---

### 3. Static Code Generators — LLM Se Generate Nahi Hota

```ts
// tumhara coding/component-generator.ts
frontendGenerator.generatePage(name)  // → hamesha same hardcoded template
```

**Replit Agent:** LLM ko actual task description + existing codebase context deta hai → LLM real working code likhta hai jo task ki requirements se match karta hai.

**Tumhara system:** Template-based. Har `generate_frontend` step same boilerplate deta hai chahe task ka description kuch bhi ho. Task ki actual requirements se koi connection nahi.

---

### 4. `validate_output` Step No-Op Hai

```ts
// step-runner.ts line 128–129
case 'validate_output':
  return { success: true, output: `Validated: ${input.description ?? 'step'}` };
  // ↑ Kuch check nahi hota, hamesha success: true
```

**Replit Agent actually check karta hai:**
- TypeScript compile errors
- Syntax errors (AST parse)
- Import resolution (missing packages)
- Runtime sanity checks

---

### 5. Missing Step Types

| Step Type | Replit Agent | Tumhara Executor |
|---|---|---|
| `read_file` | ✅ | ❌ |
| `delete_file` | ✅ | ❌ |
| `search_files` / `grep` | ✅ | ❌ |
| `run_tests` | ✅ | ❌ |
| `patch_file` (unified diff apply) | ✅ | ❌ |
| `list_directory` | ✅ | ❌ |

Yeh missing types ki wajah se agent execution ke dauran:
- Existing files nahi padh sakta (context ke liye)
- Files delete nahi kar sakta
- Codebase mein search nahi kar sakta
- Tests run nahi kar sakta

---

### 6. Command Allowlist Bahut Chhota Hai

```ts
// validation/command-safety.ts line 26–31
const ALLOWED_EXECUTABLES = new Set([
  'npm', 'npx', 'pnpm', 'node', 'tsc', 'tsx',
  'ls', 'cat', 'echo', 'mkdir', 'cp', 'mv', 'touch',
  'git', 'grep', 'find', 'which', 'env',
]);
```

**Missing executables:**

| Executable | Use Case |
|---|---|
| `python3`, `pip` | Python projects |
| `cargo`, `rustc` | Rust projects |
| `go` | Go projects |
| `java`, `mvn`, `gradle` | Java projects |
| `sh`, `bash` | Shell scripts |
| `curl`, `wget` | Package downloads |
| `unzip`, `tar` | Archive extraction |
| `prisma` | Prisma ORM |
| `drizzle-kit` | Drizzle migrations |

**Yeh restriction ki wajah se sirf Node.js projects ban sakti hain.**

---

### 7. Checkpoint In-Memory Only + 50 File Limit

```ts
// recovery/checkpoint-manager.ts line 8
const checkpoints = new Map<string, CheckpointData>(); // ← server restart = sab gone

// line 20
const files = await fileSearch.listDir(...).slice(0, 50); // ← max 50 files only!
```

**Problems:**
- Server restart pe sare checkpoints delete ho jaate hain
- 50+ files wale projects mein incomplete snapshot banta hai
- Rollback unreliable ho jaata hai bade projects mein

**Replit Agent:** Disk par persist karta hai, restart-safe hai.

---

### 8. Shell Output 500 Chars Pe Cut Hota Hai

```ts
// step-runner.ts line 111, 118, 124
output: result.stdout.slice(0, 500)  // ← important errors cut ho jaate hain
```

**Problem:** Compilation errors, stack traces, aur npm install warnings sab truncate ho jaate hain. Agent ko pata nahi chalta kya actually galat hua.

**Replit Agent:** Full output streaming, real-time frontend mein dikhta hai.

---

## 🟡 MEDIUM — Important But Secondary

| Gap | Detail |
|---|---|
| **No real-time streaming** | Shell output buffer mein collect hota hai, frontend ko real-time nahi milta |
| **Retry sirf 2 attempts** | `maxAttempts: 2` hardcoded, configurable nahi, aur no exponential backoff |
| **No file context to LLM** | Execution ke dauran LLM existing files nahi padh sakta — blind code generation |
| **`task-interpreter` static** | Har category → same fixed steps, task description ignored hoti hai |
| **No dependency tracking between steps** | Step B, Step A ke output par depend nahi kar sakta |
| **No token budget management** | LLM calls ke liye koi token limit/tracking nahi |

---

## 🟢 Kya Sahi Hai (Tumhare Paas Hai)

| Feature | Status |
|---|---|
| Session management | ✅ |
| Event emission (SSE) | ✅ |
| Sandbox path validation | ✅ |
| Basic file write/read | ✅ |
| Checkpoint create/rollback structure | ✅ (in-memory) |
| Telemetry logger + metrics | ✅ |
| Command blocklist (rm -rf, sudo, etc.) | ✅ |
| npm install/run steps | ✅ |
| Graceful timeout handling | ✅ |
| Execution history recording | ✅ |

---

## 📋 Fix Priority Order

```
Priority 1 — LLM Tool-Calling Loop
  → Core functionality missing, static pipeline ko dynamic banao

Priority 2 — edit_file Fix (old_string / new_string)
  → Abhi broken hai, agent existing code modify nahi kar sakta

Priority 3 — Missing Step Types
  → read_file, delete_file, search_files, run_tests add karo

Priority 4 — validate_output Real Banao
  → Abhi no-op hai, TypeScript/syntax check add karo

Priority 5 — Command Allowlist Expand Karo
  → Python, Rust, Go, bash, curl, prisma, drizzle-kit add karo

Priority 6 — Checkpoint Disk Persist Karo
  → Server restart pe data loss band karo, 50 file limit hatao

Priority 7 — Output Truncation Hatao
  → 500 char limit ki jagah full output pass karo
```

---

## Core Architecture Difference — Summary

```
Replit Agent Executor:
  Input (task) → LLM (decides tool) → Tool Call → LLM (reads result, decides next) → Loop → Done
  ↑ Dynamic, context-aware, adaptive

Tumhara Executor:
  Input (task) → task-interpreter.ts (static map) → fixed steps[] → run in order → Done
  ↑ Predictable, but rigid — no AI decision-making during execution
```

**Sabse bada gap:** Tumhara executor ek **static pipeline** hai.  
Replit Agent ka executor ek **thinking loop** hai jisme LLM har step pe decide karta hai.
