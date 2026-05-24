/**
 * AgentView.tsx
 *
 * Real-time agent execution monitor.
 * Replaces the "content placeholder" stub with a live view of:
 *   - Active / recent orchestration runs
 *   - Per-run agent event stream (dag.agent.execute, dag.verify, tool events)
 *   - DAG executor wiring health status
 */

import { useState, useCallback } from "react";
import { useQuery }              from "@tanstack/react-query";
import { useRealtimeTopic }      from "@/realtime/useRealtimeStream";
import { Badge }                 from "@/components/ui/badge";
import { ScrollArea }            from "@/components/ui/scroll-area";
import { Bot, CheckCircle, XCircle, Clock, Activity, Zap, ShieldCheck } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface OrchRun {
  runId:     string;
  projectId: number;
  goal?:     string;
  mode?:     string;
  phase?:    string;
  status?:   string;
  startedAt?: number;
}

interface AgentBusEvent {
  runId?:     string;
  projectId?: number;
  eventType?: string;
  agentName?: string;
  phase?:     string;
  payload?:   Record<string, unknown>;
  ts?:        number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function statusColor(eventType?: string): string {
  if (!eventType) return "text-zinc-400";
  if (eventType.includes("completed") || eventType.includes("done")) return "text-green-400";
  if (eventType.includes("failed") || eventType.includes("error"))   return "text-red-400";
  if (eventType.includes("started") || eventType.includes("execute")) return "text-blue-400";
  return "text-zinc-300";
}

function StatusIcon({ status }: { status?: string }) {
  if (status === "complete" || status === "completed")
    return <CheckCircle className="w-3.5 h-3.5 text-green-400" />;
  if (status === "failed" || status === "error")
    return <XCircle className="w-3.5 h-3.5 text-red-400" />;
  if (status === "running" || status === "execute")
    return <Activity className="w-3.5 h-3.5 text-blue-400 animate-pulse" />;
  return <Clock className="w-3.5 h-3.5 text-zinc-500" />;
}

function elapsed(ts?: number): string {
  if (!ts) return "";
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60)   return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

function eventLabel(e: AgentBusEvent): string {
  const t = e.eventType ?? "";
  if (t === "dag.agent.execute")    return "Agent dispatch";
  if (t === "dag.agent.started")    return "Agent started";
  if (t === "dag.agent.completed")  return "Agent done";
  if (t === "dag.agent.failed")     return "Agent failed";
  if (t === "dag.verify.execute")   return "Verify dispatch";
  if (t === "dag.verify.started")   return "Verify started";
  if (t === "dag.verify.completed") return "Verify done";
  if (t === "dag.verify.failed")    return "Verify failed";
  if (t.startsWith("tool."))        return `Tool: ${t.slice(5)}`;
  return t || "event";
}

function EventIcon({ e }: { e: AgentBusEvent }) {
  const t = e.eventType ?? "";
  if (t.includes("verify"))   return <ShieldCheck className="w-3 h-3 text-purple-400 flex-shrink-0" />;
  if (t.includes("failed"))   return <XCircle className="w-3 h-3 text-red-400 flex-shrink-0" />;
  if (t.includes("completed")) return <CheckCircle className="w-3 h-3 text-green-400 flex-shrink-0" />;
  if (t.includes("agent"))    return <Bot className="w-3 h-3 text-blue-400 flex-shrink-0" />;
  return <Zap className="w-3 h-3 text-yellow-400 flex-shrink-0" />;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function AgentView() {
  const [selectedRun, setSelectedRun] = useState<string | null>(null);

  const { data: runsData } = useQuery<{ ok: boolean; runs: OrchRun[] }>({
    queryKey: ["/api/orchestration/runs"],
    refetchInterval: 3_000,
  });

  const liveEvents = useRealtimeTopic("agent", 200);

  const runs = runsData?.runs ?? [];

  const events = useCallback((): AgentBusEvent[] => {
    const all = liveEvents as AgentBusEvent[];
    if (!selectedRun) return all.slice(-60);
    return all.filter((e) => e.runId === selectedRun).slice(-100);
  }, [liveEvents, selectedRun])();

  return (
    <div
      className="h-full flex flex-col bg-zinc-950 text-zinc-200 text-xs"
      data-testid="agent-view"
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-zinc-800 flex-shrink-0">
        <Bot className="w-4 h-4 text-blue-400" />
        <span className="font-semibold text-zinc-100">Agent Monitor</span>
        <Badge
          variant="outline"
          className="ml-auto text-[10px] border-zinc-700 text-zinc-400"
          data-testid="badge-event-count"
        >
          {liveEvents.length} events
        </Badge>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Run list panel */}
        <div
          className="w-44 border-r border-zinc-800 flex flex-col flex-shrink-0"
          data-testid="panel-run-list"
        >
          <div className="px-2 py-1.5 text-[10px] text-zinc-500 uppercase tracking-wide border-b border-zinc-800">
            Runs
          </div>
          <ScrollArea className="flex-1">
            <div
              className={`p-1 cursor-pointer hover:bg-zinc-900 rounded mx-1 my-0.5 flex items-center gap-1.5
                ${!selectedRun ? "bg-zinc-900" : ""}`}
              onClick={() => setSelectedRun(null)}
              data-testid="run-filter-all"
            >
              <Activity className="w-3 h-3 text-zinc-500 flex-shrink-0" />
              <span className={!selectedRun ? "text-blue-400" : "text-zinc-400"}>
                All events
              </span>
            </div>
            {runs.map((run) => (
              <div
                key={run.runId}
                className={`p-1 cursor-pointer hover:bg-zinc-900 rounded mx-1 my-0.5 flex items-start gap-1.5
                  ${selectedRun === run.runId ? "bg-zinc-900 ring-1 ring-inset ring-blue-900" : ""}`}
                onClick={() => setSelectedRun(run.runId)}
                data-testid={`run-filter-${run.runId.slice(0, 8)}`}
              >
                <StatusIcon status={run.status} />
                <div className="flex flex-col min-w-0">
                  <span className="font-mono text-zinc-300 truncate">
                    {run.runId.slice(0, 12)}
                  </span>
                  <span className="text-zinc-600 truncate">{run.mode ?? "run"}</span>
                </div>
              </div>
            ))}
            {runs.length === 0 && (
              <div
                className="text-zinc-600 px-2 py-4 text-center"
                data-testid="text-no-runs"
              >
                No active runs
              </div>
            )}
          </ScrollArea>
        </div>

        {/* Event stream panel */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="px-2 py-1.5 text-[10px] text-zinc-500 uppercase tracking-wide border-b border-zinc-800 flex items-center gap-2">
            Event stream
            {selectedRun && (
              <span
                className="font-mono text-blue-400 text-[10px]"
                data-testid="text-selected-run"
              >
                {selectedRun.slice(0, 18)}…
              </span>
            )}
          </div>
          <ScrollArea className="flex-1">
            <div className="p-1 space-y-0.5" data-testid="event-stream-list">
              {events.length === 0 && (
                <div
                  className="text-zinc-600 px-2 py-6 text-center"
                  data-testid="text-empty-stream"
                >
                  Waiting for agent events…
                </div>
              )}
              {[...events].reverse().map((ev, i) => (
                <div
                  key={i}
                  className="flex items-start gap-1.5 px-1.5 py-1 rounded hover:bg-zinc-900"
                  data-testid={`event-row-${i}`}
                >
                  <EventIcon e={ev} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-1.5">
                      <span className={`font-medium ${statusColor(ev.eventType)}`}>
                        {eventLabel(ev)}
                      </span>
                      {ev.agentName && (
                        <span className="text-zinc-600 truncate">{ev.agentName}</span>
                      )}
                      <span className="ml-auto text-zinc-700 flex-shrink-0 font-mono">
                        {elapsed(ev.ts)}
                      </span>
                    </div>
                    {ev.runId && (
                      <div className="text-zinc-700 font-mono truncate text-[10px]">
                        {ev.runId.slice(0, 24)}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      </div>
    </div>
  );
}
