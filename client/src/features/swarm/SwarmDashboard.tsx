/**
 * client/src/features/swarm/SwarmDashboard.tsx
 *
 * Main swarm visualization dashboard.
 * Shows: phase banner, agent map, task graph, event log, conflict counter.
 */

import { Badge }  from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useSwarmEvents } from "./useSwarmEvents";
import { SwarmAgentMap }  from "./SwarmAgentMap";
import { SwarmTaskGraph } from "./SwarmTaskGraph";
import type { SwarmPhase } from "./swarm-types";

interface SwarmDashboardProps {
  runId:     string;
  projectId: number;
}

const PHASE_COLORS: Record<SwarmPhase, string> = {
  initializing: "bg-slate-500/20 text-slate-300 border-slate-500/40",
  spawning:     "bg-blue-500/20  text-blue-300  border-blue-500/40",
  "wave-1":     "bg-violet-500/20 text-violet-300 border-violet-500/40",
  "wave-2":     "bg-indigo-500/20 text-indigo-300 border-indigo-500/40",
  "wave-3":     "bg-cyan-500/20  text-cyan-300   border-cyan-500/40",
  "wave-4":     "bg-teal-500/20  text-teal-300   border-teal-500/40",
  merging:      "bg-amber-500/20 text-amber-300  border-amber-500/40",
  completed:    "bg-green-500/20 text-green-300  border-green-500/40",
  failed:       "bg-red-500/20   text-red-300    border-red-500/40",
  recovering:   "bg-orange-500/20 text-orange-300 border-orange-500/40",
};

export function SwarmDashboard({ runId, projectId }: SwarmDashboardProps) {
  const { swarmState, events, conflicts, isConnected, error, clearEvents } =
    useSwarmEvents(runId, projectId);

  const phase    = swarmState?.phase ?? "initializing";
  const colorCls = PHASE_COLORS[phase] ?? PHASE_COLORS.initializing;

  return (
    <div className="flex flex-col gap-4 h-full" data-testid="swarm-dashboard">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">Active Swarm</span>
          <Badge
            variant="outline"
            className={`text-xs capitalize ${colorCls}`}
            data-testid="swarm-phase-badge"
          >
            {phase.replace("-", " ")}
          </Badge>
          {conflicts > 0 && (
            <Badge variant="outline" className="text-xs bg-yellow-500/10 text-yellow-400 border-yellow-500/30" data-testid="swarm-conflict-count">
              {conflicts} conflict{conflicts !== 1 ? "s" : ""}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${isConnected ? "bg-green-400 animate-pulse" : "bg-slate-500"}`} data-testid="swarm-connection-dot" />
          <span className="text-[11px] text-muted-foreground">{isConnected ? "live" : "offline"}</span>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="rounded border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-300" data-testid="swarm-error">
          {error}
        </div>
      )}

      {/* Empty state */}
      {!swarmState && (
        <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground" data-testid="swarm-empty">
          Waiting for swarm to start…
        </div>
      )}

      {swarmState && (
        <div className="flex flex-col gap-4 flex-1 min-h-0">

          {/* Agent Map */}
          <Card className="bg-card/30">
            <CardHeader className="pb-2 pt-3 px-4">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Agent Map · {swarmState.agents.length} agents
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-3">
              <SwarmAgentMap
                agents={swarmState.agents}
                taskGraph={swarmState.taskGraph}
              />
            </CardContent>
          </Card>

          {/* Task Graph */}
          <Card className="bg-card/30">
            <CardHeader className="pb-2 pt-3 px-4">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Task Graph
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-3">
              <SwarmTaskGraph tasks={swarmState.taskGraph} />
            </CardContent>
          </Card>

          {/* Live event log */}
          <Card className="bg-card/30 flex-1 min-h-0">
            <CardHeader className="pb-2 pt-3 px-4 flex-row items-center justify-between">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Event Log · {events.length}
              </CardTitle>
              <button
                onClick={clearEvents}
                className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                data-testid="swarm-clear-events"
              >
                clear
              </button>
            </CardHeader>
            <CardContent className="px-4 pb-3 h-[160px]">
              <ScrollArea className="h-full">
                <div className="space-y-1 font-mono text-[11px]">
                  {events.map((ev, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-2 text-muted-foreground"
                      data-testid={`swarm-event-${i}`}
                    >
                      <span className="text-[10px] opacity-50 shrink-0">
                        {new Date(ev.ts).toLocaleTimeString()}
                      </span>
                      <span className="font-semibold text-foreground/80 shrink-0">
                        {ev.type}
                      </span>
                      <span className="opacity-60 truncate">
                        {JSON.stringify(ev.payload).slice(0, 80)}
                      </span>
                    </div>
                  ))}
                  {events.length === 0 && (
                    <div className="text-muted-foreground/50 text-center py-4">
                      No events yet
                    </div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
