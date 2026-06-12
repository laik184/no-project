# NURAX — System Architecture Diagrams

> Mermaid diagrams: real-time work log, full architecture, and slide-ready breakdowns.

---

## 1. Real-Time Work Log — What the AI Does Step by Step

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant CO as Chat Orchestrator
    participant SV as Supervisor Agent
    participant MM as Memory Platform
    participant PL as Planner Agent
    participant OL as Orchestration Loop
    participant CX as CoderX Agent
    participant EX as Executor Agent
    participant TR as Tool Registry (158 tools)
    participant VR as Verifier Agent
    participant EB as EventBus
    participant SSE as SSE Manager
    participant UI as Frontend (React)

    User->>CO: "Build a login page with JWT auth"
    CO->>EB: emit run.lifecycle → PENDING
    EB->>SSE: fan-out to UI
    SSE->>UI: 🟡 Run started

    CO->>SV: delegate(runId, projectId, goal)
    SV->>MM: buildMemoryContext(projectId)
    MM-->>SV: "Past: chose Drizzle ORM, JWT pattern exists"

    SV->>PL: plan(goal, memoryContext)
    Note over PL: keyword scan → [auth, frontend, api, database]<br/>dependency rules → database→api→auth→frontend
    PL-->>SV: ExecutionPlan{wave1:[database,api], wave2:[auth], wave3:[frontend]}

    SV->>OL: execute(plan)
    EB->>SSE: emit agent.event → "Wave 1 starting"
    SSE->>UI: 🔄 Wave 1/3 — database + api

    OL->>CX: runCodingLoop(task=database)
    CX->>TR: dispatch("scanFolder", {path:"."})
    TR-->>CX: current file tree
    CX->>TR: dispatch("generateSchema", {entities:["User","Session"]})
    TR-->>CX: Drizzle schema code
    CX->>TR: dispatch("writeFile", {path:"shared/schema.ts", content:...})
    TR-->>CX: ✓ written
    EB->>SSE: emit agent.event → "writeFile shared/schema.ts"
    SSE->>UI: 📝 File written

    OL->>CX: runCodingLoop(task=api)
    CX->>TR: dispatch("generateExpressRoute", {resource:"auth"})
    TR-->>CX: route code (login, logout, refresh)
    CX->>TR: dispatch("writeFile", {path:"server/routes/auth.ts"})
    TR-->>CX: ✓ written

    OL->>EX: run(task=auth)
    EX->>TR: dispatch("installPackage", {pkg:"jsonwebtoken"})
    TR-->>EX: ✓ installed
    EX->>TR: dispatch("npmRunScript", {script:"db:push"})
    TR-->>EX: ✓ schema pushed

    OL->>CX: runCodingLoop(task=frontend)
    CX->>MM: save(lesson="JWT login page uses react-hook-form + zod")
    CX->>TR: dispatch("generateReactPage", {name:"LoginPage"})
    TR-->>CX: React component code
    CX->>TR: dispatch("writeFile", {path:"client/src/pages/Login.tsx"})
    TR-->>CX: ✓ written

    OL->>VR: verify(phases=[typecheck,build,runtime])
    VR->>TR: dispatch("runTypecheck")
    TR-->>VR: ✓ 0 errors
    VR->>TR: dispatch("runBuild")
    TR-->>VR: ✓ build passed
    VR->>TR: dispatch("checkServerHealth")
    TR-->>VR: ✓ HTTP 200

    VR-->>OL: VerificationResult{ok:true}
    OL-->>SV: RunResult{ok:true, filesWritten:4}
    SV->>MM: save(decision="JWT auth complete, schema in shared/schema.ts")
    EB->>SSE: emit run.lifecycle → COMPLETED
    SSE->>UI: ✅ Run complete
    SV-->>CO: success
    CO-->>User: "Login page with JWT auth is ready"
```

---

## 2. Workflow Architecture Diagram — How All Components Connect

```mermaid
flowchart TD
    subgraph CLIENT["🖥️ Frontend — React + Vite (port 5000)"]
        UI_CHAT["ChatPanel\n(user input)"]
        UI_FEED["AgentActionFeed\n(live steps)"]
        UI_LOGS["LogsPanel\n(console output)"]
        UI_PREV["PreviewPane\n(iframe :sandbox-port)"]
        UI_FILES["FileExplorer\n(project tree)"]
        SSE_HOOK["useRealtimeFeed()\nSSE subscriber"]
    end

    subgraph PROXY["Vite Proxy (/api → :3001)"]
        VITE_PROXY["proxy: /api /sse /events /ws /preview"]
    end

    subgraph SERVER["⚙️ Backend — Express (port 3001)"]

        subgraph ENTRY["Entry Layer"]
            HTTP["Express App\nmain.ts"]
            CO["Chat Orchestrator\nchat-orchestrator.ts"]
            WS["WebSocket Server"]
        end

        subgraph AGENTS["🤖 Agent Hierarchy"]
            SV["Supervisor Agent\nlifecycle owner"]
            PL["Planner Agent\ngoal → ExecutionPlan"]
            OL["Orchestration Loop\nwave executor"]
            CX["CoderX Agent\ncode generation"]
            EX["Executor Agent\ntask runner"]
            TA["Terminal Agent\nshell (gated)"]
            FA["Filesystem Agent\ncomplex I/O"]
            BA["Browser Agent\nPlaywright automation"]
            VR["Verifier Agent\ntypecheck+build+runtime"]
        end

        subgraph TOOLS["🔧 Tool Registry (sealed at boot)"]
            TD["tool-dispatcher.ts\ndispatch(name, args, ctx)"]
            TFS["Filesystem Tools\n40+ tools"]
            TCO["Coding Tools\n47 tools"]
            TTE["Terminal Tools\n27 tools"]
            TVE["Verifier Tools\n12 tools"]
            TBR["Browser Tools\n27 tools"]
            TGI["Git Tools\n5 tools"]
        end

        subgraph MEMORY["🧠 Memory Platform"]
            MR["Memory Repository\nread/write orchestrator"]
            VS["VectorStore\nin-memory Map"]
            HE["HashEmbeddingProvider\n128-dim local vectors"]
            CH["Chunker\ncode/md/json/text"]
            PS["Persistence Adapter\n.nurax-memory/vector-store.json"]
        end

        subgraph EVENTS["📡 Observability"]
            EB["TypedEventBus\nNode EventEmitter"]
            BA_SSE["Bus Adapter\nnormalises events"]
            SM["SSE Manager\nfan-out to clients\n1000-event buffer"]
            TM["Tool Metrics\ninvocations/failures/latency"]
            ET["Execution Timeline\nappend-only audit log"]
        end

        subgraph INFRA["🗄️ Infrastructure"]
            DB["PostgreSQL\nvia Drizzle ORM"]
            REDIS["Redis / BullMQ\njob queue (optional)"]
            SB["Sandbox\n.sandbox/{project-slug}"]
            RM["Runtime Manager\nmanaged child processes"]
        end

        subgraph ERRORS["🛡️ Error & Recovery"]
            GH["Global Handlers\nuncaughtException"]
            EM["Express Middleware\nerror serialiser"]
            RTY["Retry Manager\n3× exponential backoff"]
            SHL["Self-Healing Loop\nMAX 3 heal cycles"]
            RCE["Recovery Engine\nclassify + repair plan"]
            RBK["Rollback Manager\ncheckpoint + revert"]
        end
    end

    subgraph AI["🌐 AI Layer"]
        OR["OpenRouter API\nhttps://openrouter.ai"]
        LLM["LLM\nopenai/gpt-oss-120b:free"]
    end

    subgraph HEALTH["🔬 Health"]
        HD["Startup Diagnostics\nenv checks on boot"]
        RHM["Runtime Health Monitor\n60s sweep, stuck-session detect"]
    end

    %% Client → Server
    UI_CHAT -->|POST /api/chat| VITE_PROXY
    UI_FILES -->|GET /api/file-explorer| VITE_PROXY
    SSE_HOOK -->|GET /api/realtime| VITE_PROXY
    VITE_PROXY --> HTTP

    %% Server entry
    HTTP --> CO
    CO -->|build intent| SV
    CO -->|chat intent| LLM

    %% Agent hierarchy
    SV --> PL
    SV --> OL
    OL --> CX
    OL --> EX
    EX --> TA
    EX --> FA
    EX --> BA
    OL --> VR

    %% All agents → tools via dispatcher
    CX -->|dispatch| TD
    EX -->|dispatch| TD
    TA -->|dispatch| TD
    BA -->|dispatch| TD
    VR -->|dispatch| TD
    TD --> TFS & TCO & TTE & TVE & TBR & TGI

    %% Memory
    SV -->|buildMemoryContext| MR
    CX -->|save lesson| MR
    MR --> HE --> VS
    MR --> CH
    VS <--> PS
    MR --> DB

    %% Events
    SV & CX & EX & VR & OL -->|emit| EB
    EB --> BA_SSE --> SM
    SM -->|SSE stream| SSE_HOOK
    SSE_HOOK --> UI_FEED & UI_LOGS & UI_PREV

    %% Tool metrics
    TD --> TM
    CX --> ET

    %% LLM
    TCO -->|CodeGen prompt| OR --> LLM
    LLM -->|JSON response| TCO
    CO -->|chat messages| OR

    %% Infra
    TFS --> SB
    TTE --> RM
    RM --> SB
    MR --> DB
    OL --> REDIS

    %% Error
    HTTP --> EM
    OL --> RTY
    EX --> SHL
    SHL --> RCE --> RBK
    RBK --> SB

    %% Health
    HD --> HTTP
    RHM --> EB
```

---

## 3. Slide-Ready Breakdown

---

### Slide 1 — What is NURAX?

```mermaid
mindmap
  root((NURAX))
    What it is
      Autonomous AI coding platform
      Describe app in plain English
      AI builds it end-to-end
    What it produces
      React frontend
      Express backend
      Database schema
      Auth flows
      Full test suites
    How it works
      Multi-agent hierarchy
      158 registered tools
      Persistent memory
      Real-time UI feedback
    Tech stack
      React + Vite frontend
      Express + Node backend
      PostgreSQL + Drizzle ORM
      OpenRouter LLM API
```

---

### Slide 2 — The 5-Tier Agent Hierarchy

```mermaid
flowchart TD
    U(["👤 User\n'Build a login page'"]):::user

    T1["🎯 Tier 0 — Chat Orchestrator\nRoutes intent: chat vs build"]:::t0
    T2["🔭 Tier 1 — Supervisor\nLifecycle owner · recalls memory · validates result"]:::t1
    T3["🗺️ Tier 2 — Planner\nGoal → ordered ExecutionPlan\n(keyword engine + dependency rules)"]:::t2

    subgraph T4["⚡ Tier 3 — Execution Specialists"]
        CX["CoderX\ncode writer"]
        EX["Executor\ntask runner"]
        TA["Terminal\nshell (gated)"]
        BA["Browser\nPlaywright UI"]
        FA["Filesystem\ncomplex I/O"]
    end

    T5["✅ Tier 4 — Verifier\ntypecheck → build → runtime QA"]:::t4

    U --> T1 --> T2 --> T3 --> T4 --> T5

    classDef user fill:#6366f1,color:#fff,stroke:none
    classDef t0 fill:#8b5cf6,color:#fff,stroke:none
    classDef t1 fill:#0ea5e9,color:#fff,stroke:none
    classDef t2 fill:#10b981,color:#fff,stroke:none
    classDef t4 fill:#f59e0b,color:#fff,stroke:none
```

---

### Slide 3 — The Tool Registry (158 Tools, Sealed at Boot)

```mermaid
flowchart LR
    A["Agent\ndispatch(name, args)"] --> D

    subgraph D["🔒 Dispatcher\ntool-dispatcher.ts"]
        D1["1 Lookup tool"] --> D2["2 Permission check"]
        D2 --> D3["3 Zod validation"]
        D3 --> D4["4 Timeout wrap"]
        D4 --> D5["5 Execute handler"]
        D5 --> D6["6 Record metrics"]
    end

    D --> FS["📁 Filesystem\n40+ tools\nread · write · patch · search"]
    D --> CO["💻 Coding\n47 tools\ngenerate React/Express/Auth/CRUD"]
    D --> TE["🖥️ Terminal\n27 tools\nexec · install · npm · process"]
    D --> VE["✅ Verifier\n12 tools\ntypecheck · build · health"]
    D --> BR["🌐 Browser\n27 tools\nPlaywright navigate · click · screenshot"]
    D --> GI["🔀 Git\n5 tools\nstatus · diff · commit"]

    style D fill:#1e293b,color:#fff,stroke:#334155
```

---

### Slide 4 — Memory Platform (How the AI Remembers)

```mermaid
flowchart LR
    subgraph WRITE["✍️ Save a lesson"]
        W1["Raw content\n'Chose Drizzle ORM because...'"]
        W2["Chunker\nsplit by type: code/md/text"]
        W3["HashEmbeddingProvider\n→ 128-dim vector"]
        W4["VectorStore\nin-memory Map"]
        W5["JSON file\n.nurax-memory/vector-store.json"]
        W1 --> W2 --> W3 --> W4 --> W5
    end

    subgraph READ["🔍 Recall before each run"]
        R1["Query: 'database ORM'"]
        R2["Embed query → vector"]
        R3["Cosine similarity scan"]
        R4["+ Keyword score TF-IDF"]
        R5["+ Exact phrase boost"]
        R6["Top-K results"]
        R7["Formatted context string\ninjected into agent prompt"]
        R1 --> R2 --> R3 --> R4 --> R5 --> R6 --> R7
    end

    W5 -.->|hydrate on boot| W4
    R2 -.->|same provider| W3
```

---

### Slide 5 — Real-Time Observability Pipeline

```mermaid
flowchart LR
    subgraph SOURCES["Event Sources"]
        AG["Agents\nemit step events"]
        TO["Tool Dispatcher\nemit tool metrics"]
        RM["Runtime Manager\nemit process events"]
    end

    subgraph BUS["📡 EventBus"]
        EB["TypedEventBus\nNode EventEmitter"]
        BA["Bus Adapter\nnormalises topics"]
    end

    subgraph SSE["SSE Manager"]
        POOL["Connection Pool\nper client"]
        BUF["1,000 event buffer\nreconnect replay"]
        HB["Heartbeat ping\nevery 30s"]
    end

    subgraph UI["Frontend UI"]
        AF["AgentActionFeed\nlive steps"]
        LP["LogsPanel\nconsole output"]
        PP["PreviewPane\nauto-refresh"]
        SB2["StatusBar\nrun state badge"]
    end

    SOURCES --> EB --> BA --> SSE
    POOL --> AF & LP & PP & SB2
    BUF --> POOL
    HB --> POOL
```

---

### Slide 6 — Error Recovery Ladder

```mermaid
flowchart TD
    F(["❌ Failure occurs"])

    L1["Layer 1\nGlobal Handler\nuncaughtException\n→ log, stay alive"]
    L2["Layer 2\nExpress Middleware\n→ JSON error envelope\n{ ok:false, error:{code,severity} }"]
    L3["Layer 3\nRetry Manager\n3× exponential backoff\ncontinue / retry / skip / abort"]
    L4["Layer 4\nSelf-Healing Loop\nMAX 3 cycles\ncheckpoint → diagnose → repair → retry"]
    L5["Layer 5\nEscalation\nstructured error summary\n→ user notified"]

    F --> L1
    L1 -->|route error| L2
    L2 -->|orchestration fail| L3
    L3 -->|still failing| L4
    L4 -->|unrecoverable| L5

    subgraph REPAIR["Recovery Engine strategies"]
        S1["patch-recovery\nTypeScript errors → CoderX re-runs"]
        S2["install-recovery\nMissing package → npm install"]
        S3["browser-restart\nPlaywright crash → relaunch"]
        S4["rollback\nRevert files to last checkpoint"]
    end

    L4 --> REPAIR

    style F fill:#ef4444,color:#fff,stroke:none
    style L5 fill:#f97316,color:#fff,stroke:none
```

---

### Slide 7 — End-to-End Request Lifecycle

```mermaid
journey
    title NURAX — "Build a login page" from prompt to running code
    section Receive
      User types goal: 5: User
      Chat Orchestrator routes to build: 5: ChatOrchestrator
    section Plan
      Supervisor recalls memory: 4: Supervisor
      Planner classifies domains: 5: Planner
      Wave order determined db→api→auth→ui: 5: Planner
    section Build — Wave 1
      CoderX writes Drizzle schema: 5: CoderX
      CoderX writes Express auth routes: 5: CoderX
      Executor installs jsonwebtoken: 4: Executor
    section Build — Wave 2
      CoderX writes JWT middleware: 5: CoderX
      Executor runs db:push migration: 4: Executor
    section Build — Wave 3
      CoderX writes React LoginPage: 5: CoderX
      CoderX writes useAuth hook: 5: CoderX
    section Verify
      Verifier runs tsc — 0 errors: 5: Verifier
      Verifier runs vite build — passed: 5: Verifier
      Verifier pings /health — 200 OK: 5: Verifier
    section Complete
      Supervisor saves lesson to memory: 4: Supervisor
      Run marked COMPLETED: 5: System
      User sees live preview: 5: User
```
