export type ToolCategory = 'filesystem' | 'generation' | 'analysis';

export interface ToolParam {
  type: string;
  description: string;
  required?: boolean;
}

export interface ToolMeta {
  name: string;
  description: string;
  category: ToolCategory;
  parameters: Record<string, ToolParam>;
}

const registry = new Map<string, ToolMeta>();

export function registerTool(meta: ToolMeta): void {
  registry.set(meta.name, meta);
}

export function getTool(name: string): ToolMeta | undefined {
  return registry.get(name);
}

export function getAllTools(): ToolMeta[] {
  return Array.from(registry.values());
}

export function getToolsByCategory(category: ToolCategory): ToolMeta[] {
  return getAllTools().filter(t => t.category === category);
}

registerTool({
  name: 'write_file',
  description: 'Write content to a file at the given path. Creates directories as needed.',
  category: 'filesystem',
  parameters: {
    path: { type: 'string', description: 'File path relative to project root', required: true },
    content: { type: 'string', description: 'Full file content to write', required: true },
  },
});

registerTool({
  name: 'read_file',
  description: 'Read and return the content of an existing file.',
  category: 'filesystem',
  parameters: {
    path: { type: 'string', description: 'File path to read', required: true },
  },
});

registerTool({
  name: 'edit_file',
  description: 'Replace an exact section of an existing file with new content.',
  category: 'filesystem',
  parameters: {
    path: { type: 'string', description: 'File path to edit', required: true },
    old_content: { type: 'string', description: 'Exact text to find and replace', required: true },
    new_content: { type: 'string', description: 'Replacement text', required: true },
  },
});

registerTool({
  name: 'generate_api',
  description: 'Generate a typed Express CRUD API for a given resource and return the code.',
  category: 'generation',
  parameters: {
    resource: { type: 'string', description: 'Resource name, e.g. "user" or "product"', required: true },
    fields: { type: 'string', description: 'Comma-separated field names, e.g. "name,email,role"', required: true },
  },
});
