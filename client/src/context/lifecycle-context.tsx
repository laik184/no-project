/**
 * lifecycle-context.tsx
 *
 * Global agent lifecycle state derived from live SSE events.
 * Maps backend events → LifecycleState → label/description/isActive.
 *
 * State priority (terminal always wins, then latest active state):
 *   Failed > Cancelled > Completed > Deploying > Verifying > Testing
 *   > Writing > Working > Delegating > Planning > Thinking > Idle
 */
import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { useRealtime } from "@/realtime/realtime-provider";

export type LifecycleState =
  | "idle" | "thinking" | "planning" | "delegating" | "working"
  | "writing" | "editing" | "testing" | "verifying" | "deploying"
  | "completed" | "failed" | "cancelled";

export interface LifecycleInfo {
  state:              LifecycleState;
  label:              string;
  description:        string;
  dynamicDescription: string;
  isActive:           boolean;
}

const TERMINAL: LifecycleState[] = ["completed", "failed", "cancelled"];

const STATE_META: Record<LifecycleState, { label: string; description: string; active: boolean }> = {
  idle:       { label: "Idle",          description: "Ready",                     active: false },
  thinking:   { label: "Thinking...",   description: "Analyzing request",         active: true  },
  planning:   { label: "Planning...",   description: "Building execution plan",   active: true  },
  delegating: { label: "Delegating...", description: "Assigning work to agents",  active: true  },
  working:    { label: "Working...",    description: "Executing task",            active: true  },
  writing:    { label: "Writing...",    description: "Saving file",               active: true  },
  editing:    { label: "Editing...",    description: "Modifying existing files",  active: true  },
  testing:    { label: "Testing...",    description: "Running validations",       active: true  },
  verifying:  { label: "Verifying...",  description: "Checking generated output", active: true  },
  deploying:  { label: "Deploying...",  description: "Publishing application",    active: true  },
  completed:  { label: "Completed",     description: "Task finished successfully", active: false },
  failed:     { label: "Failed",        description: "Execution failed",          active: false },
  cancelled:  { label: "Cancelled",     description: "Execution cancelled",       active: false },
};

const LifecycleContext = createContext<LifecycleInfo>({
  state:              "idle",
  label:              "Idle",
  description:        "Ready",
  dynamicDescription: "Ready",
  isActive:           false,
});

export function LifecycleProvider({ children }: { children: React.ReactNode }) {
  const { subscribe } = useRealtime();
  const [state,      setState]      = useState<LifecycleState>("idle");
  const [dynDesc,    setDynDesc]    = useState("");
  const resetRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lockedRef = useRef(false); // prevent stale events after terminal state resets

  const transition = useCallback((next: LifecycleState, desc?: string) => {
    if (lockedRef.current && !TERMINAL.includes(next)) return;

    setState(next);
    if (desc !== undefined) setDynDesc(desc);

    if (TERMINAL.includes(next)) {
      lockedRef.current = true;
      if (resetRef.current) clearTimeout(resetRef.current);
      resetRef.current = setTimeout(() => {
        setState("idle");
        setDynDesc("");
        lockedRef.current = false;
      }, 3500);
    } else {
      lockedRef.current = false;
    }
  }, []);

  useEffect(() => {
    const offAgent = subscribe("agent", (raw: unknown) => {
      const e = raw as {
        eventType?: string;
        phase?:     string;
        agentName?: string;
        payload?:   Record<string, any>;
        status?:    string;
      };

      switch (e.eventType) {
        case "chat.run.started":
        case "agent.thinking":
        case "agent.replanning":
          transition("thinking");
          break;

        case "plan.created":
        case "orchestration.workflow.started":
          transition("planning");
          break;

        case "phase.started": {
          const agentType = e.payload?.agentType ?? e.agentName;
          if (agentType === "verifier") {
            transition("verifying", "Checking generated output");
          } else {
            transition("delegating", e.payload?.label || "Assigning work to agents");
          }
          break;
        }

        case "agent.tool_call": {
          const tool   = e.payload?.tool   || "";
          const status = e.payload?.status;
          if (tool === "task_complete") break;
          if (status === "running") {
            const lbl = e.payload?.label || tool.replace(/_/g, " ");
            transition("working", lbl);
          }
          break;
        }

        case "file.written": {
          const p = (e.payload?.path || "").split("/").pop() || "file";
          transition("writing", `Writing ${p}`);
          break;
        }

        case "file.diff":
        case "diff.queued": {
          const raw2 = e.payload?.diff?.filePath || e.payload?.path || e.payload?.filePath || "";
          const p = raw2.split("/").pop() || "file";
          transition("writing", `Updating ${p}`);
          break;
        }
      }
    });

    const offLifecycle = subscribe("lifecycle", (raw: unknown) => {
      const e = raw as { status?: string };
      if (e.status === "completed") transition("completed");
      else if (e.status === "failed")    transition("failed");
      else if (e.status === "cancelled") transition("cancelled");
    });

    return () => { offAgent(); offLifecycle(); };
  }, [subscribe, transition]);

  useEffect(() => () => {
    if (resetRef.current) clearTimeout(resetRef.current);
  }, []);

  const meta = STATE_META[state];
  return (
    <LifecycleContext.Provider value={{
      state,
      label:              meta.label,
      description:        meta.description,
      dynamicDescription: dynDesc || meta.description,
      isActive:           meta.active,
    }}>
      {children}
    </LifecycleContext.Provider>
  );
}

export function useLifecycle(): LifecycleInfo {
  return useContext(LifecycleContext);
}
