import type { RefinedPrompt, StructuredIntent } from "../../types.ts";
import type { GoalInput } from "../../../Core-Planning/types.ts";
import { analyzeGoal as coreAnalyzeGoal } from "../../../Core-Planning/agents/goal-analyzer.agent.ts";

let _goalSeq = 0;
function makeGoalId(): string {
  _goalSeq += 1;
  return `pb-goal-${Date.now()}-${String(_goalSeq).padStart(4, "0")}`;
}

const CAPABILITY_KEYWORDS: ReadonlyArray<{ keyword: string; capability: string }> = Object.freeze([
  { keyword: "auth", capability: "auth" },
  { keyword: "database", capability: "database" },
  { keyword: "schema", capability: "database" },
  { keyword: "api", capability: "api" },
  { keyword: "test", capability: "testing" },
  { keyword: "deploy", capability: "deployment" },
  { keyword: "docker", capability: "devops" },
  { keyword: "frontend", capability: "frontend" },
  { keyword: "component", capability: "frontend" },
  { keyword: "mobile", capability: "mobile" },
  { keyword: "graphql", capability: "api" },
  { keyword: "migration", capability: "database" },
  { keyword: "cache", capability: "performance" },
  { keyword: "websocket", capability: "realtime" },
  { keyword: "refactor", capability: "code-quality" },
  { keyword: "optimize", capability: "performance" },
]);

function inferCapabilities(prompt: Readonly<RefinedPrompt>): readonly string[] {
  const found = new Set<string>();
  const allTerms = [...prompt.keywords, ...prompt.normalized.split(" ")];
  for (const { keyword, capability } of CAPABILITY_KEYWORDS) {
    if (allTerms.some((t) => t.includes(keyword))) {
      found.add(capability);
    }
  }
  return Object.freeze([...found]);
}

function buildSuccessCriteria(objective: string, constraints: readonly string[]): readonly string[] {
  const criteria: string[] = [
    "All required capabilities are implemented",
    "No breaking changes to existing functionality",
    "Code follows project conventions",
  ];
  if (constraints.length > 0) {
    criteria.push(`All constraints are satisfied: ${constraints.join(", ")}`);
  }
  if (objective.length > 0) {
    criteria.push(`Primary objective achieved: ${objective.slice(0, 60)}`);
  }
  return Object.freeze(criteria);
}

export function analyzeGoal(prompt: Readonly<RefinedPrompt>): Readonly<StructuredIntent> {
  const requiredCapabilities = inferCapabilities(prompt);

  const goalInput: GoalInput = Object.freeze({
    goalId: makeGoalId(),
    primaryObjective:
      prompt.normalized.length > 0
        ? prompt.normalized.charAt(0).toUpperCase() + prompt.normalized.slice(1)
        : prompt.intent,
    subObjectives: Object.freeze(
      prompt.constraints.length > 0
        ? [`Respect constraints: ${prompt.constraints.join(", ")}`]
        : [],
    ),
    constraints: prompt.constraints,
    requiredCapabilities: Object.freeze(prompt.keywords.slice(0, 10)),
    estimatedComplexity: parseFloat(
      Math.min(
        0.1 +
          prompt.keywords.length * 0.05 +
          prompt.constraints.length * 0.1 +
          requiredCapabilities.length * 0.08,
        1.0,
      ).toFixed(2),
    ),
  });

  const analyzed = coreAnalyzeGoal(goalInput);

  return Object.freeze<StructuredIntent>({
    primaryObjective: analyzed.primaryObjective,
    subObjectives: analyzed.subObjectives,
    successCriteria: buildSuccessCriteria(analyzed.primaryObjective, analyzed.constraints),
    constraints: analyzed.constraints,
    requiredCapabilities,
    estimatedComplexity: analyzed.estimatedComplexity,
  });
}
