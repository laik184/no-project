import type { Bottleneck, ImprovementAction, StrategyType } from "../types";

export interface ImprovementPlannerOutput {
  success: boolean;
  logs: string[];
  error?: string;
  actions?: ImprovementAction[];
}

interface ActionTemplate {
  title: string;
  description: string;
  strategy: StrategyType;
  estimatedImpact: number;
  estimatedEffort: number;
}

const ACTION_CATALOG: Record<string, ActionTemplate[]> = {
  latency: [
    {
      title: "Enable response caching",
      description: "Cache frequent responses to reduce repeated computation latency",
      strategy: "cache",
      estimatedImpact: 75,
      estimatedEffort: 30,
    },
    {
      title: "Parallelize I/O operations",
      description: "Run independent I/O calls concurrently with Promise.all to cut wall-clock time",
      strategy: "parallelize",
      estimatedImpact: 65,
      estimatedEffort: 40,
    },
    {
      title: "Optimize hot-path algorithms",
      description: "Profile and rewrite the highest-frequency code paths for lower time complexity",
      strategy: "optimize",
      estimatedImpact: 60,
      estimatedEffort: 60,
    },
  ],
  "error-rate": [
    {
      title: "Tune retry policy",
      description: "Adjust retry delays, max attempts, and backoff multiplier to reduce transient errors",
      strategy: "retry-tune",
      estimatedImpact: 70,
      estimatedEffort: 20,
    },
    {
      title: "Add circuit breaker",
      description: "Wrap downstream calls in a circuit breaker to prevent error cascades",
      strategy: "optimize",
      estimatedImpact: 60,
      estimatedEffort: 35,
    },
  ],
  "success-rate": [
    {
      title: "Improve input validation",
      description: "Add upstream schema validation to reject malformed requests before processing",
      strategy: "refactor",
      estimatedImpact: 55,
      estimatedEffort: 25,
    },
    {
      title: "Harden error handling paths",
      description: "Add explicit catch blocks and fallback responses in all execution branches",
      strategy: "refactor",
      estimatedImpact: 50,
      estimatedEffort: 30,
    },
  ],
  memory: [
    {
      title: "Introduce object pooling",
      description: "Reuse frequently allocated objects to reduce GC pressure and heap size",
      strategy: "optimize",
      estimatedImpact: 60,
      estimatedEffort: 50,
    },
    {
      title: "Enable streaming responses",
      description: "Stream large payloads instead of buffering in memory",
      strategy: "refactor",
      estimatedImpact: 55,
      estimatedEffort: 45,
    },
  ],
  cpu: [
    {
      title: "Offload CPU tasks to worker threads",
      description: "Move blocking computation off the event loop using worker_threads",
      strategy: "parallelize",
      estimatedImpact: 70,
      estimatedEffort: 55,
    },
    {
      title: "Cache computed results",
      description: "Memoize expensive pure-function outputs to avoid redundant CPU cycles",
      strategy: "cache",
      estimatedImpact: 60,
      estimatedEffort: 20,
    },
  ],
  "validation-quality": [
    {
      title: "Expand validation rule set",
      description: "Add missing validator coverage for security, schema, and consistency dimensions",
      strategy: "refactor",
      estimatedImpact: 65,
      estimatedEffort: 35,
    },
  ],
  "recovery-failures": [
    {
      title: "Tune recovery strategies",
      description: "Adjust retry caps and recovery action catalog for chronically failing failure types",
      strategy: "retry-tune",
      estimatedImpact: 70,
      estimatedEffort: 25,
    },
  ],
};

let actionCounter = 0;

function makeId(area: string): string {
  actionCounter = (actionCounter + 1) % 10000;
  return `action-${area}-${actionCounter}`;
}

export function planImprovements(bottlenecks: Bottleneck[]): ImprovementPlannerOutput {
  const logs: string[] = [];

  try {
    const actions: ImprovementAction[] = [];
    const seen = new Set<string>();

    for (const bn of bottlenecks) {
      const templates = ACTION_CATALOG[bn.area] ?? [];
      for (const tpl of templates) {
        const key = `${bn.area}::${tpl.title}`;
        if (seen.has(key)) continue;
        seen.add(key);

        const impactBoost = bn.severity === "critical" ? 10 : bn.severity === "high" ? 5 : 0;

        actions.push({
          id: makeId(bn.area),
          title: tpl.title,
          description: tpl.description,
          strategy: tpl.strategy,
          targetArea: bn.area,
          estimatedImpact: Math.min(100, tpl.estimatedImpact + impactBoost),
          estimatedEffort: tpl.estimatedEffort,
          optimizationScore: 0,
          priority: 0,
        });
        logs.push(`[improvement-planner] planned: "${tpl.title}" for area=${bn.area}`);
      }
    }

    if (actions.length === 0) {
      logs.push("[improvement-planner] no bottlenecks to plan for — system performing well");
    } else {
      logs.push(`[improvement-planner] generated ${actions.length} action(s)`);
    }

    return { success: true, logs, actions };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logs.push(`[improvement-planner] ERROR: ${message}`);
    return { success: false, logs, error: message };
  }
}
