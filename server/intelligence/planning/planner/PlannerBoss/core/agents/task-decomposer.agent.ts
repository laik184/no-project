import type { AtomicTask, StructuredIntent, TaskType } from "../../types.ts";
import type { AnalyzedGoal, TaskCategory } from "../../../Core-Planning/types.ts";
import { decomposeTasks as coreDecomposeTasks } from "../../../Core-Planning/agents/task-decomposer.agent.ts";

let _taskSeq = 0;

function makeTaskId(): string {
  _taskSeq += 1;
  return `task-${String(_taskSeq).padStart(4, "0")}`;
}

export function resetTaskSequence(): void {
  _taskSeq = 0;
}

const CAPABILITY_TO_CATEGORY: ReadonlyArray<readonly [string, TaskCategory]> = Object.freeze([
  ["api", "api-layer"],
  ["database", "data-modeling"],
  ["testing", "testing"],
  ["deployment", "deployment"],
  ["devops", "deployment"],
  ["auth", "business-logic"],
  ["code-generation", "business-logic"],
  ["code-fix", "business-logic"],
  ["refactoring", "business-logic"],
  ["code-quality", "business-logic"],
  ["frontend", "api-layer"],
  ["mobile", "api-layer"],
  ["realtime", "api-layer"],
  ["performance", "business-logic"],
]);

function mapCapabilitiesToCategories(capabilities: readonly string[]): readonly TaskCategory[] {
  const categories = new Set<TaskCategory>();
  for (const cap of capabilities) {
    const lower = cap.toLowerCase();
    let matched = false;
    for (const [keyword, category] of CAPABILITY_TO_CATEGORY) {
      if (lower.includes(keyword)) {
        categories.add(category);
        matched = true;
        break;
      }
    }
    if (!matched) {
      categories.add("business-logic");
    }
  }
  if (categories.size === 0) {
    categories.add("business-logic");
    categories.add("api-layer");
  }
  return Object.freeze([...categories]);
}

export function decomposeTasks(intent: Readonly<StructuredIntent>): readonly AtomicTask[] {
  const taskCategories = mapCapabilitiesToCategories(intent.requiredCapabilities);

  const analyzedGoal: AnalyzedGoal = Object.freeze({
    goalId: `pb-analyzed-${Date.now()}`,
    primaryObjective: intent.primaryObjective,
    subObjectives: intent.subObjectives,
    taskCategories,
    estimatedComplexity: intent.estimatedComplexity,
    constraints: intent.constraints,
    scopeKeywords: Object.freeze(
      intent.requiredCapabilities
        .concat(intent.primaryObjective.toLowerCase().split(" ").slice(0, 10))
        .slice(0, 40),
    ),
  });

  const planTasks = coreDecomposeTasks(analyzedGoal);

  return Object.freeze(
    planTasks.map((planTask): Readonly<AtomicTask> =>
      Object.freeze({
        id: makeTaskId(),
        type: planTask.type as TaskType,
        label: planTask.label,
        description: planTask.description,
        inputs: planTask.inputs,
        outputs: planTask.outputs,
        estimatedEffort: planTask.estimatedEffort,
        priority: planTask.priority,
        optional: planTask.optional,
      }),
    ),
  );
}
