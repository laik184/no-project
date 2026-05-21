/**
 * server/security/detectors/index.ts
 * Public API for all security detectors.
 */

export { detectSecretLeaks }           from "./secret-leak-detector.ts";
export { detectUnsafeEval }            from "./unsafe-eval-detector.ts";
export { detectCommandInjection }      from "./command-injection-detector.ts";
export { detectSSRF }                  from "./ssrf-detector.ts";
export { detectPathTraversal }         from "./path-traversal-detector.ts";
export { detectEnvMutation }           from "./env-mutation-detector.ts";
export { detectPrivilegeEscalation }   from "./privilege-escalation-detector.ts";
export { detectDangerousDependency }   from "./dangerous-dependency-detector.ts";
export type { SecurityFinding, SecurityReport, SecurityThreat, ThreatSeverity } from "./types.ts";
