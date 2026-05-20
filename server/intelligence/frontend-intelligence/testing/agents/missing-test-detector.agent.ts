import type {
  ComponentDescriptor,
  ComponentTestMapping,
  IssueSeverity,
  MissingTestIssue,
} from "../types.js";
import { computeCriticalityScore } from "../utils/component-resolver.util.js";

const CRITICAL_SCORE_THRESHOLD = 70;
const HIGH_SCORE_THRESHOLD = 40;

const HIGH_IMPACT_TYPES: readonly string[] = Object.freeze([
  "page",
  "form",
  "context",
]);

function deriveMissingSeverity(component: ComponentDescriptor): IssueSeverity {
  const score = computeCriticalityScore(component);
  if (score >= CRITICAL_SCORE_THRESHOLD) return "CRITICAL";
  if (score >= HIGH_SCORE_THRESHOLD || HIGH_IMPACT_TYPES.includes(component.type)) return "HIGH";
  if (component.type === "hook" || component.type === "layout") return "MEDIUM";
  return "LOW";
}

function buildMissingReason(component: ComponentDescriptor): string {
  const traits: string[] = [];
  if (HIGH_IMPACT_TYPES.includes(component.type)) {
    traits.push(`${component.type}-level component`);
  }
  if (component.hasState) traits.push("manages state");
  if (component.hasEffects) traits.push("has side effects");
  if (component.isExported) traits.push("exported for external use");

  const base = `"${component.name}" has no associated test file.`;
  if (traits.length === 0) return `${base} No coverage data available.`;
  return `${base} This component ${traits.join(", ")}, making it a testing priority.`;
}

function buildMissingSuggestion(component: ComponentDescriptor): string {
  const testPath = component.filePath.replace(
    /\.(tsx?|jsx?)$/i,
    ".test.$1"
  );
  if (component.type === "hook") {
    return (
      `Create "${testPath}" using renderHook() from @testing-library/react. ` +
      `Verify initial state, state transitions, and cleanup.`
    );
  }
  if (component.type === "form") {
    return (
      `Create "${testPath}" using render() + userEvent. ` +
      `Test: field validation, submit behavior, and error state rendering.`
    );
  }
  if (component.type === "page") {
    return (
      `Create "${testPath}" with render(). ` +
      `Test: initial render, data loading states, navigation actions, and error boundaries.`
    );
  }
  if (component.type === "context") {
    return (
      `Create "${testPath}". ` +
      `Wrap consumers in provider, verify default values, and test context updates.`
    );
  }
  return (
    `Create "${testPath}" with render() and snapshot/behavior assertions ` +
    `covering props, user interactions, and conditional rendering.`
  );
}

export function detectMissingTests(
  components: readonly ComponentDescriptor[],
  mappings: readonly ComponentTestMapping[]
): readonly MissingTestIssue[] {
  const untestedIds = new Set<string>(
    mappings.filter((m) => !m.isTested).map((m) => m.componentId)
  );

  const componentById = new Map<string, ComponentDescriptor>(
    components.map((c) => [c.id, c])
  );

  const issues: MissingTestIssue[] = [];

  for (const id of untestedIds) {
    const component = componentById.get(id);
    if (component === undefined) continue;

    const severity = deriveMissingSeverity(component);
    issues.push(
      Object.freeze({
        componentId: component.id,
        componentName: component.name,
        filePath: component.filePath,
        severity,
        reason: buildMissingReason(component),
        suggestion: buildMissingSuggestion(component),
      })
    );
  }

  const order: Record<IssueSeverity, number> = {
    CRITICAL: 0,
    HIGH: 1,
    MEDIUM: 2,
    LOW: 3,
  };
  issues.sort((a, b) => order[a.severity] - order[b.severity]);

  return Object.freeze(issues);
}
