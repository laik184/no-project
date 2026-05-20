import type {
  TaskDependencyMap,
  ExecutionStrategy,
  TaskExecutionUnit,
  RetryConfig,
  RetryStrategy,
  ExecutionMode,
  TaskType,
} from "../../types.ts";

const EFFORT_TO_DURATION_MS = 1_000;
const PARALLEL_THRESHOLD    = 2;

const RETRY_POLICY: Readonly<Record<TaskType, Omit<RetryConfig, never>>> = Object.freeze({
  ANALYZE:   Object.freeze({ strategy: "FIXED"        as RetryStrategy, maxAttempts: 2, delayMs: 500  }),
  CONFIGURE: Object.freeze({ strategy: "FIXED"        as RetryStrategy, maxAttempts: 3, delayMs: 1000 }),
  CREATE:    Object.freeze({ strategy: "EXPONENTIAL"  as RetryStrategy, maxAttempts: 3, delayMs: 2000 }),
  MODIFY:    Object.freeze({ strategy: "EXPONENTIAL"  as RetryStrategy, maxAttempts: 3, delayMs: 2000 }),
  VALIDATE:  Object.freeze({ strategy: "FIXED"        as RetryStrategy, maxAttempts: 2, delayMs: 500  }),
  TEST:      Object.freeze({ strategy: "FIXED"        as RetryStrategy, maxAttempts: 2, delayMs: 1000 }),
  DOCUMENT:  Object.freeze({ strategy: "NONE"         as RetryStrategy, maxAttempts: 1, delayMs: 0    }),
  DEPLOY:    Object.freeze({ strategy: "EXPONENTIAL"  as RetryStrategy, maxAttempts: 2, delayMs: 5000 }),
  REVIEW:    Object.freeze({ strategy: "NONE"         as RetryStrategy, maxAttempts: 1, delayMs: 0    }),
  DELETE:    Object.freeze({ strategy: "NONE"         as RetryStrategy, maxAttempts: 1, delayMs: 0    }),
});

function getRetryConfig(type: TaskType): RetryConfig {
  return RETRY_POLICY[type] ?? Object.freeze({ strategy: "NONE" as RetryStrategy, maxAttempts: 1, delayMs: 0 });
}

function buildExecutionUnits(depMap: TaskDependencyMap): readonly TaskExecutionUnit[] {
  const units: TaskExecutionUnit[] = [];

  for (let levelIdx = 0; levelIdx < depMap.executionLevels.length; levelIdx++) {
    const level       = depMap.executionLevels[levelIdx] ?? [];
    const canParallel = level.length >= PARALLEL_THRESHOLD;

    for (const taskId of level) {
      const task = depMap.tasks.find(t => t.id === taskId);
      if (task === undefined) continue;

      units.push(Object.freeze<TaskExecutionUnit>({
        task,
        executionLevel: levelIdx,
        canParallelize: canParallel,
        retryConfig:    getRetryConfig(task.type),
      }));
    }
  }

  return Object.freeze(units);
}

function determineMode(units: readonly TaskExecutionUnit[]): ExecutionMode {
  const hasParallel   = units.some(u => u.canParallelize);
  const hasSequential = units.some(u => !u.canParallelize);

  if (hasParallel && hasSequential) return "MIXED";
  if (hasParallel)                  return "PARALLEL";
  return "SEQUENTIAL";
}

function estimateTotalDuration(units: readonly TaskExecutionUnit[]): number {
  if (units.length === 0) return 0;

  const levelGroups = new Map<number, TaskExecutionUnit[]>();
  for (const unit of units) {
    const existing = levelGroups.get(unit.executionLevel) ?? [];
    existing.push(unit);
    levelGroups.set(unit.executionLevel, existing);
  }

  let totalMs = 0;
  for (const group of levelGroups.values()) {
    const maxEffort = Math.max(...group.map(u => u.task.estimatedEffort));
    totalMs += maxEffort * EFFORT_TO_DURATION_MS;
  }

  return totalMs;
}

function countParallelGroups(units: readonly TaskExecutionUnit[]): number {
  const levelGroups = new Map<number, TaskExecutionUnit[]>();
  for (const unit of units) {
    const existing = levelGroups.get(unit.executionLevel) ?? [];
    existing.push(unit);
    levelGroups.set(unit.executionLevel, existing);
  }

  let count = 0;
  for (const group of levelGroups.values()) {
    if (group.length >= PARALLEL_THRESHOLD) count += 1;
  }
  return count;
}

export function buildStrategy(depMap: TaskDependencyMap): ExecutionStrategy {
  const units             = buildExecutionUnits(depMap);
  const mode              = determineMode(units);
  const estimatedDuration = estimateTotalDuration(units);
  const parallelGroups    = countParallelGroups(units);

  return Object.freeze<ExecutionStrategy>({
    mode,
    units,
    estimatedDuration,
    totalTasks:   units.length,
    parallelGroups,
  });
}
