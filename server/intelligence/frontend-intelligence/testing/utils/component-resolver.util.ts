import type { ComponentDescriptor, ComponentType } from "../types.js";

const PAGE_PATTERNS: readonly RegExp[] = Object.freeze([
  /page$/i,
  /view$/i,
  /screen$/i,
  /route$/i,
  /\/pages\//i,
  /\/views\//i,
  /\/screens\//i,
]);

const FORM_PATTERNS: readonly RegExp[] = Object.freeze([
  /form$/i,
  /input$/i,
  /field$/i,
  /wizard$/i,
  /checkout$/i,
  /signup$/i,
  /login$/i,
  /register$/i,
]);

const LAYOUT_PATTERNS: readonly RegExp[] = Object.freeze([
  /layout$/i,
  /shell$/i,
  /wrapper$/i,
  /container$/i,
  /frame$/i,
  /\/layout\//i,
]);

const CONTEXT_PATTERNS: readonly RegExp[] = Object.freeze([
  /context$/i,
  /provider$/i,
  /store$/i,
  /\/context\//i,
]);

const HOOK_PATTERNS: readonly RegExp[] = Object.freeze([
  /^use[A-Z]/,
  /hook$/i,
  /\/hooks\//i,
]);

const UTIL_PATTERNS: readonly RegExp[] = Object.freeze([
  /util$/i,
  /helper$/i,
  /service$/i,
  /\/utils\//i,
  /\/helpers\//i,
  /\/services\//i,
]);

export function inferComponentType(
  name: string,
  filePath: string
): ComponentType {
  const combined = name + " " + filePath;
  if (PAGE_PATTERNS.some((p) => p.test(combined))) return "page";
  if (FORM_PATTERNS.some((p) => p.test(combined))) return "form";
  if (LAYOUT_PATTERNS.some((p) => p.test(combined))) return "layout";
  if (CONTEXT_PATTERNS.some((p) => p.test(combined))) return "context";
  if (HOOK_PATTERNS.some((p) => p.test(name))) return "hook";
  if (UTIL_PATTERNS.some((p) => p.test(combined))) return "util";
  return "ui";
}

const CRITICALITY_WEIGHTS: Readonly<Record<ComponentType, number>> = Object.freeze({
  page: 35,
  form: 30,
  layout: 20,
  context: 25,
  hook: 20,
  ui: 10,
  util: 5,
});

const STATE_BONUS = 15;
const EFFECTS_BONUS = 15;
const PROPS_BONUS = 10;
const EXPORTED_BONUS = 5;

export function computeCriticalityScore(component: ComponentDescriptor): number {
  let score = CRITICALITY_WEIGHTS[component.type];
  if (component.hasState) score += STATE_BONUS;
  if (component.hasEffects) score += EFFECTS_BONUS;
  if (component.hasProps) score += PROPS_BONUS;
  if (component.isExported) score += EXPORTED_BONUS;
  return Math.min(100, score);
}

export function buildCriticalityReasons(component: ComponentDescriptor): readonly string[] {
  const reasons: string[] = [];
  if (component.type === "page") reasons.push("Page-level component: entry point for users");
  if (component.type === "form") reasons.push("Form component: handles user input and validation");
  if (component.type === "layout") reasons.push("Layout component: structural impact on all child routes");
  if (component.type === "context") reasons.push("Context/Provider: shared state consumed by many components");
  if (component.type === "hook") reasons.push("Custom hook: shared logic used across the application");
  if (component.hasState) reasons.push("Manages internal state");
  if (component.hasEffects) reasons.push("Has side effects (useEffect)");
  if (component.hasProps) reasons.push("Receives props — contract must be verified");
  if (component.isExported) reasons.push("Exported: used by other modules");
  return Object.freeze(reasons);
}

const CRITICAL_SCORE_THRESHOLD = 40;

export function isCritical(component: ComponentDescriptor): boolean {
  return computeCriticalityScore(component) >= CRITICAL_SCORE_THRESHOLD;
}
