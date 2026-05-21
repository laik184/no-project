/**
 * server/hallucination/index.ts
 * Public API for the hallucination resistance system.
 */

export { runHallucinationGate }       from "./hallucination-gate.ts";
export type { HallucinationGateInput } from "./hallucination-gate.ts";
export { detectFakeDependencies }     from "./fake-dependency-detector.ts";
export { detectNonexistentFiles }     from "./nonexistent-file-detector.ts";
export { detectFakeCompletion }       from "./fake-completion-detector.ts";
export { detectRepeatedStrategy }     from "./repeated-strategy-detector.ts";
export type {
  HallucinationType,
  HallucinationSignal,
  HallucinationReport,
} from "./types.ts";
