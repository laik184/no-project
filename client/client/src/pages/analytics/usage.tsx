import { AlertCircle, Activity, CheckCircle2, XCircle, Clock, RefreshCw } from "lucide-react";
import { Card } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";

interface AgentMetrics {
  totalRuns: number;
  successCount: number;
  failureCount: number;
  avgDurationMs: number;
  successRate: number | null;
  phaseFailureCounts: Record<string, number>;
}

export default function Usage() {
  const { data: metrics, isLoading } = useQuery<AgentMetrics>({
    queryKey: ["/api/agents/metrics"],
    refetchInterval: 15_000,
  });

  const successRate = metrics?.successRate ?? 0;
  const avgSec = metrics ? (metrics.avgDurationMs / 1000).toFixed(1) : "0.0";

  return (
    <div className="flex-1 flex flex-col h-full bg-background">
      <header className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold" data-testid="text-usage-title">Usage</h1>
        </div>
      </header>

      <div className="flex-1 p-4 sm:p-6 overflow-auto">
        <div className="max-w-6xl mx-auto space-y-6">

          {/* LLM key warning */}
          <Card className="p-4 bg-orange-500/10 border-orange-500/20">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-orange-500 mt-0.5 shrink-0" />
              <p className="text-sm text-foreground">
                Add <code className="bg-white/10 px-1 rounded text-xs">OPENROUTER_API_KEY</code> in Replit Secrets to enable AI agent runs.
              </p>
            </div>
          </Card>

          {/* ── Agent Run Metrics (live) ── */}
          <div>
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2" data-testid="heading-agent-metrics">
              <Activity className="h-5 w-5 text-primary" />
              Agent Run Metrics
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {/* Total Runs */}
              <Card className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <RefreshCw className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Total Runs</span>
                </div>
                {isLoading ? (
                  <Skeleton className="h-8 w-16 mt-1" />
                ) : (
                  <p className="text-3xl font-bold" data-testid="metric-total-runs">{metrics?.totalRuns ?? 0}</p>
                )}
              </Card>

              {/* Success */}
              <Card className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Succeeded</span>
                </div>
                {isLoading ? (
                  <Skeleton className="h-8 w-16 mt-1" />
                ) : (
                  <p className="text-3xl font-bold text-emerald-500" data-testid="metric-success-count">{metrics?.successCount ?? 0}</p>
                )}
              </Card>

              {/* Failed */}
              <Card className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <XCircle className="h-4 w-4 text-destructive" />
                  <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Failed</span>
                </div>
                {isLoading ? (
                  <Skeleton className="h-8 w-16 mt-1" />
                ) : (
                  <p className="text-3xl font-bold text-destructive" data-testid="metric-failure-count">{metrics?.failureCount ?? 0}</p>
                )}
              </Card>

              {/* Avg Duration */}
              <Card className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Avg Duration</span>
                </div>
                {isLoading ? (
                  <Skeleton className="h-8 w-16 mt-1" />
                ) : (
                  <p className="text-3xl font-bold" data-testid="metric-avg-duration">{avgSec}s</p>
                )}
              </Card>
            </div>

            {/* Success rate bar */}
            {!isLoading && (metrics?.totalRuns ?? 0) > 0 && (
              <div className="mt-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-muted-foreground">Success rate</span>
                  <span className="text-xs font-semibold" data-testid="metric-success-rate">{successRate}%</span>
                </div>
                <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-emerald-500 transition-all duration-700"
                    style={{ width: `${successRate}%` }}
                    data-testid="bar-success-rate"
                  />
                </div>
              </div>
            )}
          </div>

          {/* ── Billing Overview (static UI — no billing backend yet) ── */}
          <div>
            <h2 className="text-xl font-semibold mb-4" data-testid="heading-billing-overview">
              Billing overview
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-2">Your plan</h3>
                  <div className="text-base font-semibold" data-testid="text-plan">Starter</div>
                  <button className="text-primary text-sm hover:underline" data-testid="link-upgrade">Upgrade to Core</button>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-2">Usage period</h3>
                  <div className="text-base" data-testid="text-usage-period">Rolling 30 days</div>
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-2">AI usage</h3>
                  <div className="text-base font-semibold" data-testid="text-usage-total">
                    {isLoading ? <Skeleton className="h-5 w-12 inline-block" /> : `${metrics?.totalRuns ?? 0} runs`}
                  </div>
                  <div className="text-sm text-muted-foreground">Powered by OpenRouter</div>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-2">Payment method</h3>
                  <div className="text-base" data-testid="text-payment-method">None</div>
                  <button className="text-primary text-sm hover:underline" data-testid="link-add-payment">Add payment</button>
                </div>
              </div>
            </div>
          </div>

          {/* Phase failure breakdown */}
          {!isLoading && Object.keys(metrics?.phaseFailureCounts ?? {}).length > 0 && (
            <div>
              <h2 className="text-xl font-semibold mb-4">Phase Failure Breakdown</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 font-medium text-muted-foreground">Phase</th>
                      <th className="text-right py-3 font-medium text-muted-foreground">Failures</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(metrics?.phaseFailureCounts ?? {}).map(([phase, count]) => (
                      <tr key={phase} className="border-b" data-testid={`row-phase-${phase}`}>
                        <td className="py-3 font-mono text-xs">{phase}</td>
                        <td className="text-right py-3 text-destructive font-semibold">{count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
