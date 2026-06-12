# Dependency Rules Document
### NURAX — Import Rules: Kaun Kissse Import Kar Sakta Hai?

---

## 1. CORE PRINCIPLE — Layered Architecture

NURAX ek strict layered architecture follow karta hai. **Lower layers upar wali layers ko import NAHI kar sakti.**

```
┌─────────────────────────────────┐  ← Highest Level
│   Routes / Controllers          │
│   (thin HTTP handlers)          │
├─────────────────────────────────┤
│   Services / Orchestrators      │
│   (business logic)              │
├─────────────────────────────────┤
│   Repositories                  │
│   (data access only)            │
├─────────────────────────────────┤
│   Infrastructure                │
│   (DB, Bus, SSE, Process)       │
└─────────────────────────────────┘  ← Lowest Level

RULE: Niche wali layer upar wali layer ko NEVER import kare.
```

---

## 2. IMPORT ALLOWED MATRIX

| Module | Import KAR SAKTA HAI | Import NAHI KAR SAKTA |
|---|---|---|
| **Routes/Controllers** | Services, Repositories, Infrastructure, Shared | — |
| **Services** | Repositories, Infrastructure, Shared | Routes/Controllers |
| **Orchestrators** | Agents, Tools, Services, Repositories, Infrastructure, Shared | Routes/Controllers |
| **Agents** | Tools (via dispatcher), Memory, Infrastructure, Shared | Routes, Controllers, Services directly |
| **Repositories** | Infrastructure (db only), Shared | Routes, Services, Agents, Orchestrators |
| **Infrastructure** | `shared/schema.ts`, node built-ins, npm packages | Server modules (routes, services, agents) |
| **Tools** | Infrastructure, Shared | Agents, Orchestrators, Routes |
| **`shared/schema.ts`** | Drizzle ORM only | NOTHING from server/ or client/ |
| **Frontend `client/`** | `shared/schema.ts`, own components, npm packages | `server/` modules directly |

---

## 3. BARREL IMPORTS — Public API Pattern

Har major module ek `index.ts` barrel export karta hai. **Sirf barrel se import karo, internal files se nahi.**

### Correct ✅
```typescript
// Infrastructure barrel se
import { db, bus, sseManager, runtimeManager } from './server/infrastructure/index.ts';

// File explorer barrel se
import { fileExplorerRouter, startFileWatcher } from './server/file-explorer/index.ts';

// Preview barrel se
import { initPreviewModule, buildPreviewRouter } from './server/preview/index.ts';
```

### Wrong ❌
```typescript
// Internal file directly import karna
import { db } from './server/infrastructure/db/index.ts';
import { sseManager } from './server/infrastructure/events/sse/sse-manager.ts';
```

### Registered Barrels (Public API Surfaces)
| Barrel | Exports |
|---|---|
| `server/infrastructure/index.ts` | `db`, `bus`, `sseManager`, `runtimeManager`, `redis`, `queue`, `TOPIC`, `SANDBOX_ROOT`, `seedDefaultProject`, `degradedProjectStore` |
| `server/file-explorer/index.ts` | `fileExplorerRouter`, `legacyFileRouter`, `startFileWatcher`, `startDirectoryWatcher`, `subscribeToAgentFileEvents` |
| `server/preview/index.ts` | `initPreviewModule`, `buildPreviewRouter` |
| `server/terminal/index.ts` | `terminalRouter` |
| `server/orchestration/index.ts` | `initOrchestration`, `createOrchestrationRouter` |
| `server/chat/index.ts` | `chatOrchestrator` |
| `server/memory/index.ts` | `bootstrapMemory` |
| `server/tools/registry/tool-loader.ts` | `loadAllTools` |
| `server/shared/errors/index.ts` | `installGlobalHandlers`, `expressErrorMiddleware` |
| `shared/schema.ts` | All table definitions + TypeScript types |

---

## 4. `shared/schema.ts` — Special Rules

`shared/schema.ts` frontend aur backend dono use karte hain. Iske liye special rules hain:

### Allowed ✅
```typescript
// Frontend mein
import type { Project, ChatMessage } from '@shared/schema';

// Backend mein
import { projects, chatMessages } from '../../shared/schema.ts';
import type { InsertProject, ChatMessage } from '../../shared/schema.ts';
```

### Forbidden ❌
```typescript
// schema.ts ke andar server-only code mat likho
import { db } from '../server/infrastructure/db'; // ← NEVER
import express from 'express'; // ← NEVER in schema.ts
```

### Vite Alias (Frontend)
```typescript
// vite.config.ts mein defined:
"@shared": path.resolve(__dirname, "shared")

// Frontend mein use:
import type { Project } from '@shared/schema';
```

### tsconfig Path Alias (Backend)
```typescript
// Backend mein:
import { projects } from '../../shared/schema.ts';
// Ya relative path use karo
```

---

## 5. AGENT IMPORT RULES

Agents strict "orchestration-only" pattern follow karte hain:

### Agents KAR SAKTE HAIN ✅
```typescript
// Memory use karna
import { memoryEngine } from '../memory/index.ts';

// Infrastructure constants
import { SANDBOX_ROOT } from '../infrastructure/index.ts';

// Shared types
import type { AgentRun } from '../../shared/schema.ts';

// NPM packages
import { v4 as uuid } from 'uuid';
```

### Agents NAHI KAR SAKTE ❌
```typescript
// Direct filesystem access
import { readFileSync, writeFileSync } from 'fs'; // ← FORBIDDEN in agents

// Direct child process
import { spawn, exec } from 'child_process'; // ← FORBIDDEN in agents

// Direct HTTP calls
import fetch from 'node-fetch'; // ← FORBIDDEN in agents (use browser tool)

// Direct DB access
import { db } from '../infrastructure/db'; // ← Agents use repositories, not db directly

// Other agent import karna (circular)
import { plannerAgent } from '../planner/planner-agent.ts'; // ← FORBIDDEN
```

### Agents Tool Use Karne Ka Sahi Tarika ✅
```typescript
// Tool dispatcher ke through ONLY
import { dispatcherClient } from '../shared/dispatcher-client.ts';

const result = await dispatcherClient.dispatch('read_file', {
  filePath: 'src/App.tsx'
}, context);
```

---

## 6. TOOL IMPLEMENTATION RULES

Tools sirf ek cheez karte hain — execute hote hain:

### Tools KAR SAKTE HAIN ✅
```typescript
// Node built-ins (filesystem tools)
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, resolve } from 'path';

// Infrastructure (events emit karne ke liye)
import { bus } from '../../infrastructure/index.ts';

// NPM packages
import { glob } from 'glob';
```

### Tools NAHI KAR SAKTE ❌
```typescript
// Other tools import karna
import { writeFileTool } from './write-file.tool.ts'; // ← FORBIDDEN (use dispatcher)

// Agents import karna
import { coderxAgent } from '../../agents/coderx/'; // ← FORBIDDEN

// Routes import karna
import { chatRouter } from '../../chat/routes/'; // ← FORBIDDEN
```

---

## 7. FRONTEND IMPORT RULES

### Path Aliases (Configured in vite.config.ts)
```typescript
"@"       → client/src/
"@shared" → shared/
```

### Correct Frontend Imports ✅
```typescript
// Alias se component import
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { queryClient } from '@/lib/queryClient';

// Shared schema types (read-only)
import type { Project, ChatMessage } from '@shared/schema';

// TanStack Query (v5 object syntax ONLY)
import { useQuery, useMutation } from '@tanstack/react-query';

// Wouter routing
import { Link, useLocation } from 'wouter';
```

### Forbidden Frontend Imports ❌
```typescript
// Server code import karna
import { db } from '../../server/infrastructure/db'; // ← NEVER

// process.env use karna (Node-only)
const key = process.env.API_KEY; // ← FORBIDDEN

// Correct: use import.meta.env
const key = import.meta.env.VITE_API_KEY; // ✅
```

### TanStack Query Rules (v5)
```typescript
// ✅ CORRECT — Object syntax
const { data } = useQuery({
  queryKey: ['/api/projects'],
  // queryFn nahi likhte — default fetcher already set hai
});

// ❌ WRONG — Array syntax (v4 style)
const { data } = useQuery(['/api/projects'], fetchProjects);

// ✅ Hierarchical query keys
queryKey: ['/api/projects', projectId]  // cache invalidation ke liye

// ✅ Mutation ke baad invalidate karo
queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
```

---

## 8. CIRCULAR DEPENDENCY PREVENTION

Circular imports build fail karte hain aur hard-to-debug bugs create karte hain:

### Common Circular Patterns to Avoid

**❌ Pattern 1: Service ↔ Repository circular**
```
service.ts → imports → repository.ts
repository.ts → imports → service.ts  ← CIRCULAR
```

**❌ Pattern 2: Agent ↔ Orchestrator circular**
```
orchestrator.ts → imports → planner-agent.ts
planner-agent.ts → imports → orchestrator.ts  ← CIRCULAR
```

**❌ Pattern 3: Infrastructure ↔ Service circular**
```
db/index.ts → imports → some-service.ts
some-service.ts → imports → db/index.ts  ← CIRCULAR
```

### Solution: Barrel Isolation
Circular dependencies ko prevent karne ka tarika:
- Shared types ko `shared/schema.ts` mein rakho
- Shared utilities ko `server/shared/` mein rakho
- Infrastructure singletons ko `server/infrastructure/index.ts` barrel se export karo
- Agents kabhi directly ek dusre ko import na karen

---

## 9. NPM PACKAGE USAGE RULES

### Backend Only (client/ mein use mat karo)
```
express, pg, drizzle-orm, tsx, chokidar,
ioredis, bullmq, multer, ws, jsonwebtoken,
archiver, adm-zip, playwright
```

### Frontend Only (server/ mein use mat karo)
```
react, react-dom, @monaco-editor/react,
wouter, @tanstack/react-query, @radix-ui/*,
embla-carousel-react, vaul, recharts,
react-hook-form, react-diff-viewer-continued
```

### Both Can Use
```
zod, uuid, date-fns, marked, clsx,
tailwind-merge, lucide-react
```

---

## 10. FILE EXTENSION RULES

```typescript
// .ts imports mein extension likhna zaroori hai (ESM)
import { foo } from './bar.ts';  // ✅ Extension required

// .js extension mat likho TypeScript files pe
import { foo } from './bar.js';  // ❌ Can cause resolution errors

// node_modules packages — no extension
import express from 'express';   // ✅ Correct
```

---

## 11. ENVIRONMENT VARIABLE ACCESS RULES

### Backend (server/)
```typescript
// process.env directly access karo
const apiKey = process.env.OPENROUTER_API_KEY;
const dbUrl = process.env.DATABASE_URL;
```

### Frontend (client/)
```typescript
// import.meta.env use karo — VITE_ prefix required for exposure
const apiKey = import.meta.env.VITE_API_KEY;

// process.env FORBIDDEN in frontend
const x = process.env.KEY; // ❌ NEVER
```

---

## 12. KNOWN VIOLATIONS (Technical Debt)

| Violation | Location | Impact |
|---|---|---|
| Direct DB queries in routes | `main.ts` project CRUD | Should be in ProjectRepository |
| In-memory folders in routes | `main.ts` folder CRUD | Should be in FolderRepository with DB |
| Some agents may import shared code directly | Various | Minor coupling risk |
