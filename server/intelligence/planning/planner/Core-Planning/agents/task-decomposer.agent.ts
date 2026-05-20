import type { AnalyzedGoal, PlanTask, TaskType, TaskCategory } from "../types.js";

let _seq = 0;
function nextId(): string {
  _seq += 1;
  return `cpt-${String(_seq).padStart(4, "0")}`;
}
export function resetSequence(): void { _seq = 0; }

interface CategoryTaskSpec {
  readonly type:            TaskType;
  readonly labelSuffix:     string;
  readonly descSuffix:      string;
  readonly inputs:          readonly string[];
  readonly outputs:         readonly string[];
  readonly estimatedEffort: number;
  readonly priority:        number;
  readonly optional:        boolean;
}

const CATEGORY_SPECS: Record<string, readonly CategoryTaskSpec[]> = Object.freeze({
  "infrastructure": Object.freeze([
    { type: "CONFIGURE", labelSuffix: "infrastructure",   descSuffix: "Set up server infrastructure, ports, and host settings.",           inputs: [],                        outputs: ["infra-config"],       estimatedEffort: 3, priority: 1,  optional: false },
  ]),
  "configuration": Object.freeze([
    { type: "CONFIGURE", labelSuffix: "environment",      descSuffix: "Configure environment variables, dotenv, and runtime settings.",     inputs: [],                        outputs: ["env-config"],         estimatedEffort: 2, priority: 2,  optional: false },
  ]),
  "data-modeling": Object.freeze([
    { type: "ANALYZE",   labelSuffix: "data model",       descSuffix: "Analyze entities, relations, and schema requirements.",             inputs: ["env-config"],            outputs: ["entity-spec"],        estimatedEffort: 3, priority: 3,  optional: false },
    { type: "CREATE",    labelSuffix: "entity models",    descSuffix: "Generate entity model classes and database schema definitions.",     inputs: ["entity-spec"],           outputs: ["entity-models"],      estimatedEffort: 4, priority: 4,  optional: false },
  ]),
  "business-logic": Object.freeze([
    { type: "CREATE",    labelSuffix: "services",         descSuffix: "Implement business logic and service layer components.",             inputs: ["entity-models"],         outputs: ["service-layer"],      estimatedEffort: 5, priority: 5,  optional: false },
  ]),
  "api-layer": Object.freeze([
    { type: "CREATE",    labelSuffix: "controllers",      descSuffix: "Generate controller classes to handle HTTP requests.",               inputs: ["service-layer"],         outputs: ["controllers"],        estimatedEffort: 4, priority: 6,  optional: false },
    { type: "CREATE",    labelSuffix: "routes",           descSuffix: "Define and register API routes and endpoint mappings.",              inputs: ["controllers"],           outputs: ["routes"],             estimatedEffort: 3, priority: 7,  optional: false },
    { type: "VALIDATE",  labelSuffix: "API contracts",    descSuffix: "Validate API request/response schemas and contract compliance.",     inputs: ["routes"],                outputs: ["contract-report"],    estimatedEffort: 2, priority: 8,  optional: false },
  ]),
  "testing": Object.freeze([
    { type: "CREATE",    labelSuffix: "unit tests",       descSuffix: "Generate unit test suites for service layer components.",           inputs: ["service-layer"],         outputs: ["unit-tests"],         estimatedEffort: 4, priority: 9,  optional: true  },
    { type: "CREATE",    labelSuffix: "integration tests","descSuffix": "Generate integration tests for API endpoints and data flows.",    inputs: ["routes", "entity-models"],outputs: ["integration-tests"], estimatedEffort: 4, priority: 10, optional: true  },
    { type: "VALIDATE",  labelSuffix: "test coverage",   descSuffix: "Verify test coverage meets minimum thresholds.",                    inputs: ["unit-tests"],            outputs: ["coverage-report"],    estimatedEffort: 1, priority: 11, optional: true  },
  ]),
  "documentation": Object.freeze([
    { type: "DOCUMENT",  labelSuffix: "API docs",         descSuffix: "Generate API documentation, README, and inline code comments.",     inputs: ["routes", "entity-models"],outputs: ["api-docs"],           estimatedEffort: 2, priority: 12, optional: true  },
  ]),
  "deployment": Object.freeze([
    { type: "CONFIGURE", labelSuffix: "CI pipeline",      descSuffix: "Configure CI/CD pipeline workflows for automated build and test.",  inputs: ["unit-tests"],            outputs: ["ci-config"],          estimatedEffort: 3, priority: 13, optional: true  },
    { type: "DEPLOY",    labelSuffix: "production build", descSuffix: "Package and produce a production-ready deployable build artifact.", inputs: ["ci-config", "routes"],   outputs: ["deploy-artifact"],    estimatedEffort: 4, priority: 14, optional: true  },
  ]),
} as const);

const SHARED_REVIEW_TASK: CategoryTaskSpec = Object.freeze({
  type:            "REVIEW"    as TaskType,
  labelSuffix:     "final plan",
  descSuffix:      "Final review of all generated outputs against goal success criteria.",
  inputs:          ["contract-report"],
  outputs:         ["review-sign-off"],
  estimatedEffort: 1,
  priority:        99,
  optional:        false,
});

function buildTask(
  spec:      CategoryTaskSpec,
  objective: string,
): PlanTask {
  return Object.freeze<PlanTask>({
    id:              nextId(),
    type:            spec.type,
    category:        spec.labelSuffix.includes("infra") ? "infrastructure"
                   : spec.labelSuffix.includes("env")   ? "configuration"
                   : "business-logic",
    label:           `${spec.type}: ${spec.labelSuffix}`,
    description:     `[${objective.slice(0, 50)}] ${spec.descSuffix}`,
    inputs:          spec.inputs,
    outputs:         spec.outputs,
    estimatedEffort: spec.estimatedEffort,
    priority:        spec.priority,
    optional:        spec.optional,
  });
}

export function decomposeTasks(analyzed: AnalyzedGoal): readonly PlanTask[] {
  resetSequence();

  const tasks: PlanTask[] = [];
  const seenOutputs = new Set<string>();

  for (const category of analyzed.taskCategories) {
    const specs = CATEGORY_SPECS[category] ?? [];
    for (const spec of specs) {
      const task = buildTask(spec, analyzed.primaryObjective);
      const isDuplicate = spec.outputs.every(o => seenOutputs.has(o));
      if (isDuplicate) continue;
      for (const o of spec.outputs) seenOutputs.add(o);
      tasks.push(task);
    }
  }

  tasks.push(Object.freeze<PlanTask>({
    id:              nextId(),
    type:            SHARED_REVIEW_TASK.type,
    category:        "business-logic",
    label:           `${SHARED_REVIEW_TASK.type}: ${SHARED_REVIEW_TASK.labelSuffix}`,
    description:     `[${analyzed.primaryObjective.slice(0, 50)}] ${SHARED_REVIEW_TASK.descSuffix}`,
    inputs:          SHARED_REVIEW_TASK.inputs,
    outputs:         SHARED_REVIEW_TASK.outputs,
    estimatedEffort: SHARED_REVIEW_TASK.estimatedEffort,
    priority:        SHARED_REVIEW_TASK.priority,
    optional:        SHARED_REVIEW_TASK.optional,
  }));

  return Object.freeze(tasks.sort((a, b) => a.priority - b.priority));
}
