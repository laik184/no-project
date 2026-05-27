/**
 * runtime agent — public API
 * Handles shell execution, npm, process management, and output streaming.
 */

export { shellExecutor }      from './shell-executor.ts';
export { npmManager }         from './npm-manager.ts';
export { processManager }     from './process-manager.ts';
export { runtimeMonitor }     from './runtime-monitor.ts';
export { executeWithStreaming } from './output-streamer.ts';
export { validateCommand }    from './command-validator.ts';
export type { ShellResult }   from './shell-executor.ts';
export type { RuntimeHealth } from './runtime-monitor.ts';
