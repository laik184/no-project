/**
 * coder agent — public API
 * Handles LLM autonomous coding loop and static template-based code generation.
 */

export { runToolLoop }        from './llm/tool-loop.ts';
export { isLLMAvailable, getLLMModel } from './llm/llm-client.ts';
export { interpretTask }      from './planning/task-interpreter.ts';
export { determineStrategy }  from './planning/execution-strategy.ts';
export { selectAction }       from './planning/action-selector.ts';
export { frontendGenerator }  from './coding/frontend-generator.ts';
export { backendGenerator }   from './coding/backend-generator.ts';
export { apiGenerator }       from './coding/api-generator.ts';
export { authGenerator }      from './coding/auth-generator.ts';
export { databaseGenerator }  from './coding/database-generator.ts';
export { componentGenerator } from './coding/component-generator.ts';
export { failureMemory }      from './memory/failure-memory.ts';
export { executionMemory }    from './memory/execution-memory.ts';
export type { ToolLoopResult } from './llm/tool-loop.ts';
