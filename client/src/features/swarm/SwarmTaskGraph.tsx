/**
 * client/src/features/swarm/SwarmTaskGraph.tsx
 *
 * Visual task dependency graph for the swarm.
 * Shows waves, task nodes, dependency arrows, and status.
 */

import type { SwarmTaskNode } from "./swarm-types";
import { ROLE_LABELS, STATUS_COLORS, WAVE_LABELS } from "./swarm-types";

interface SwarmTaskGraphProps {
  tasks: SwarmTaskNode[];
}

const PRIORITY_BORDER: Record<string, string> = {
  critical: "border-red-500/60",
  high:     "border-orange-400/60",
  normal:   "border-border/60",
  low:      "border-border/30",
};

export function SwarmTaskGraph({ tasks }: SwarmTaskGraphProps) {
  const waves = [1, 2, 3, 4] as const;
  const taskMap = new Map(tasks.map(t => [t.taskId, t]));

  return (
    <div className="space-y-4 font-mono text-xs" data-testid="swarm-task-graph">
      {waves.map(wave => {
        const waveTasks = tasks.filter(t => t.wave === wave);
        if (waveTasks.length === 0) return null;

        return (
          <div key={wave} className="space-y-2">
            {/* Wave header */}
            <div className="flex items-center gap-2">
              <div className="h-px flex-1 bg-border/40" />
              <span className="text-[10px] text-muted-foreground font-sans uppercase tracking-wider px-2">
                Wave {wave} · {WAVE_LABELS[wave]}
              </span>
              <div className="h-px flex-1 bg-border/40" />
            </div>

            {/* Task nodes */}
            <div className="flex flex-wrap gap-2 pl-2">
              {waveTasks.map(task => {
                const dotColor = STATUS_COLORS[task.status] ?? "bg-slate-500";
                const borderColor = PRIORITY_BORDER[task.priority] ?? "border-border/60";

                return (
                  <div
                    key={task.taskId}
                    data-testid={`task-node-${task.taskId}`}
                    className={`rounded border ${borderColor} bg-background/60 px-3 py-2 min-w-[120px]`}
                  >
                    {/* Role + status dot */}
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className={`h-2 w-2 rounded-full shrink-0 ${dotColor}`} />
                      <span className="font-sans font-medium text-[11px]">
                        {ROLE_LABELS[task.role]}
                      </span>
                    </div>

                    {/* Status */}
                    <div className="text-[10px] text-muted-foreground font-sans capitalize">
                      {task.status}
                    </div>

                    {/* Duration */}
                    {task.durationMs !== undefined && (
                      <div className="text-[10px] text-muted-foreground/70 font-sans mt-0.5">
                        {(task.durationMs / 1000).toFixed(1)}s
                      </div>
                    )}

                    {/* Deps */}
                    {task.dependsOn.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {task.dependsOn.map(depId => {
                          const dep = taskMap.get(depId);
                          return dep ? (
                            <span
                              key={depId}
                              className="text-[9px] text-muted-foreground/60 font-sans"
                            >
                              ← {ROLE_LABELS[dep.role]}
                            </span>
                          ) : null;
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
