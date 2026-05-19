/**
 * Console system shared types (client-side mirror of server/console/types.ts)
 */

export type RuntimeState =
  | 'idle'
  | 'starting'
  | 'installing'
  | 'compiling'
  | 'ready'
  | 'restarting'
  | 'reconnecting'
  | 'crashed'
  | 'recovering'
  | 'recovered'
  | 'warning'
  | 'failed';

export interface NpmMeta {
  type:             'install-start' | 'install-progress' | 'install-done' | 'install-warning' | 'install-error';
  packages?:        number;
  vulnerabilities?: number;
  packageName?:     string;
}

export interface ViteMeta {
  type:  'starting' | 'ready' | 'hmr' | 'compile-error' | 'build-start' | 'build-done';
  url?:  string;
  file?: string;
}

export interface NodeMeta {
  type:     'stack-trace' | 'uncaught' | 'unhandled' | 'startup-error' | 'syntax-error';
  file?:    string;
  line?:    number;
  column?:  number;
  message?: string;
}

export interface ConsoleLineMeta {
  npm?:  NpmMeta;
  vite?: ViteMeta;
  node?: NodeMeta;
}

export interface LogLine {
  id:    string;
  kind:  'stdout' | 'stderr' | 'system' | 'error';
  text:  string;
  ts:    string;
  meta?: ConsoleLineMeta;
}

export interface RuntimeStateEvent {
  type:    'runtime.state';
  state:   RuntimeState;
  prev:    RuntimeState;
  message: string;
  ts:      string;
}
