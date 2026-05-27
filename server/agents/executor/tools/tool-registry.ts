/**
 * tool-registry.ts
 * Registers all available tools and their metadata.
 * Single source of truth for tool capabilities.
 */

import type { ToolName } from './tool-schema.ts';

export interface ToolMeta {
  name:        ToolName;
  category:    'filesystem' | 'runtime' | 'lifecycle';
  mutates:     boolean;  // does this tool write/delete?
  idempotent:  boolean;
}

const TOOL_META: ToolMeta[] = [
  { name: 'write_file',    category: 'filesystem', mutates: true,  idempotent: true  },
  { name: 'read_file',     category: 'filesystem', mutates: false, idempotent: true  },
  { name: 'edit_file',     category: 'filesystem', mutates: true,  idempotent: false },
  { name: 'delete_file',   category: 'filesystem', mutates: true,  idempotent: true  },
  { name: 'list_directory',category: 'filesystem', mutates: false, idempotent: true  },
  { name: 'search_files',  category: 'filesystem', mutates: false, idempotent: true  },
  { name: 'run_command',   category: 'runtime',    mutates: true,  idempotent: false },
  { name: 'npm_install',   category: 'runtime',    mutates: true,  idempotent: true  },
  { name: 'run_tests',     category: 'runtime',    mutates: false, idempotent: true  },
  { name: 'task_complete', category: 'lifecycle',  mutates: false, idempotent: true  },
];

const _registry = new Map<ToolName, ToolMeta>(
  TOOL_META.map((m) => [m.name, m]),
);

export function getToolMeta(name: string): ToolMeta | undefined {
  return _registry.get(name as ToolName);
}

export function isValidToolName(name: string): name is ToolName {
  return _registry.has(name as ToolName);
}

export function listTools(): ToolMeta[] {
  return [..._registry.values()];
}

export function listMutatingTools(): ToolName[] {
  return TOOL_META.filter((t) => t.mutates).map((t) => t.name);
}
