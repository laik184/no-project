import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Activity, CheckCircle2, XCircle, Clock, Zap } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useLiveAgentStream } from "@/hooks/useLiveAgentStream";

interface AgentMetrics {
  totalRuns: number;
  successCount: number;
  failureCount: number;
  avgDurationMs: number;
  successRate: number | null;
}

export default function Dashboard() {
  const { data: metrics, isLoading } = useQuery<AgentMetrics>({
    queryKey: ["/api/agents/metrics"],
    refetchInterval: 5_000,
  });

  const [events, setEvents] = useState<unknown[]>([]);

  const handleAny = useCallback((data: unknown) => {
    setEvents((prev) => [data, ...prev].slice(0, 50));
  }, []);

  useLiveAgentStream({
    agent: handleAny,
    lifecycle: handleAny,
    tool: handleAny,
    error: handleAny,
  });

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Activity className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold">AGI Live Dashboard</h2>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <Zap className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Total Runs</span>
          </div>
          {isLoading ? <Skeleton className="h-6 w-12" /> : <p className="text-2xl font-bold">{metrics?.totalRuns ?? 0}</p>}
        </Card>
        <Card className="p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
            <span className="text-xs text-muted-foreground">Success</span>
          </div>
          {isLoading ? <Skeleton className="h-6 w-12" /> : <p className="text-2xl font-bold text-emerald-500">{metrics?.successCount ?? 0}</p>}
        </Card>
        <Card className="p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <XCircle className="h-3.5 w-3.5 text-destructive" />
            <span className="text-xs text-muted-foreground">Failed</span>
          </div>
          {isLoading ? <Skeleton className="h-6 w-12" /> : <p className="text-2xl font-bold text-destructive">{metrics?.failureCount ?? 0}</p>}
        </Card>
        <Card className="p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Avg Duration</span>
          </div>
          {isLoading ? <Skeleton className="h-6 w-12" /> : <p className="text-2xl font-bold">{((metrics?.avgDurationMs ?? 0) / 1000).toFixed(1)}s</p>}
        </Card>
      </div>

      {/* Live event feed */}
      <Card className="p-3">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Live Agent Events</h3>
        <div
          className="max-h-64 overflow-auto rounded font-mono text-xs space-y-1"
          style={{ background: "#0b0b0b", padding: 8 }}
        >
          {events.length === 0 ? (
            <p className="text-[#444] italic">No events yet. Run an agent to see live output here.</p>
          ) : (
            events.map((e, i) => (
              <pre key={i} className="text-[#00ff88] whitespace-pre-wrap break-all">{JSON.stringify(e, null, 2)}</pre>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}
