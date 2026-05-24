/**
 * client/src/features/swarm/SwarmAgentMap.tsx
 *
 * Live agent map showing all spawned agents grouped by wave.
 * Visualizes status with color coding and pulse animations.
 */

import { Badge }  from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { SwarmAgentNode, SwarmTaskNode } from "./swarm-types";
import { ROLE_LABELS, STATUS_COLORS, WAVE_LABELS } from "./swarm-types";

interface SwarmAgentMapProps {
  agents:    SwarmAgentNode[];
  taskGraph: SwarmTaskNode[];
}

export function SwarmAgentMap({ agents, taskGraph }: SwarmAgentMapProps) {
  const waves = [1, 2, 3, 4] as const;

  return (
    <div className="space-y-3" data-testid="swarm-agent-map">
      {waves.map(wave => {
        const waveTasks = taskGraph.filter(t => t.wave === wave);
        const waveAgents = agents.filter(a =>
          waveTasks.some(t => t.taskId === a.taskId),
        );
        if (waveTasks.length === 0) return null;

        return (
          <Card key={wave} className="border border-border/60 bg-card/40">
            <CardHeader className="pb-2 pt-3 px-4">
              <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Wave {wave} — {WAVE_LABELS[wave]}
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-3">
              <div className="flex flex-wrap gap-2">
                {waveTasks.map(task => {
                  const agent  = waveAgents.find(a => a.taskId === task.taskId);
                  const status = agent?.status ?? task.status;
                  const colorClass = STATUS_COLORS[status] ?? "bg-slate-500";

                  return (
                    <div
                      key={task.taskId}
                      data-testid={`agent-card-${task.taskId}`}
                      className="flex items-center gap-1.5 rounded-md border border-border/40 bg-background/60 px-2.5 py-1.5"
                    >
                      <span className={`h-2 w-2 rounded-full shrink-0 ${colorClass}`} />
                      <span className="text-xs font-medium">
                        {ROLE_LABELS[task.role]}
                      </span>
                      <Badge
                        variant="outline"
                        className="text-[10px] h-4 px-1 font-normal"
                        data-testid={`agent-status-${task.taskId}`}
                      >
                        {status}
                      </Badge>
                      {task.durationMs !== undefined && (
                        <span className="text-[10px] text-muted-foreground">
                          {(task.durationMs / 1000).toFixed(1)}s
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
