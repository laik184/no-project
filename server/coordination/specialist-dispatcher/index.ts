/**
 * server/coordination/specialist-dispatcher/index.ts
 *
 * Public surface of the specialist dispatcher subsystem.
 * SpecialistWaveRunner imports only from this file — never internal modules.
 */

export { specialistDispatcher, SpecialistDispatcher } from "./specialist-dispatcher.ts";
export { executeSpecialist }                          from "./specialist-executor.ts";
export { getDomainConfig, domainLabel }               from "./domain-agent-router.ts";
export type { DomainExecutionConfig }                 from "./domain-agent-router.ts";
