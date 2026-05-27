import { fileHeader, toCamelCase, toPascalCase, toKebabCase } from '../utils/code-utils.ts';
import { generateCrudSchema } from '../templates/crud-template.ts';

export interface GeneratedFile {
  relativePath: string;
  content:      string;
}

export const databaseGenerator = {
  generateSchema(resourceName: string): GeneratedFile {
    return {
      relativePath: `shared/${toKebabCase(resourceName)}.schema.ts`,
      content:      generateCrudSchema(resourceName),
    };
  },

  generateMigration(resourceName: string): GeneratedFile {
    const table = toKebabCase(resourceName).replace(/-/g, '_') + 's';

    return {
      relativePath: `migrations/create_${table}.sql`,
      content:      `-- Migration: create ${table}\nCREATE TABLE IF NOT EXISTS ${table} (\n  id        TEXT PRIMARY KEY,\n  name      TEXT NOT NULL,\n  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),\n  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()\n);\n`,
    };
  },

  generateModel(resourceName: string): GeneratedFile {
    const pascal = toPascalCase(resourceName);
    const camel  = toCamelCase(resourceName);
    const kebab  = toKebabCase(resourceName);

    return {
      relativePath: `server/models/${kebab}.model.ts`,
      content:      `${fileHeader(`${pascal} data model`)}export interface ${pascal} {\n  id:        string;\n  name:      string;\n  createdAt: Date;\n  updatedAt: Date;\n}\n\nexport type Create${pascal}Input = Pick<${pascal}, 'name'>;\nexport type Update${pascal}Input = Partial<Create${pascal}Input>;\n`,
    };
  },

  generateStorageInterface(resourceName: string): GeneratedFile {
    const pascal = toPascalCase(resourceName);
    const camel  = toCamelCase(resourceName);
    const kebab  = toKebabCase(resourceName);

    return {
      relativePath: `server/storage/${kebab}.storage.ts`,
      content:      `${fileHeader(`${pascal} storage interface`)}export interface I${pascal}Storage {\n  getAll(): Promise<unknown[]>;\n  getById(id: string): Promise<unknown | null>;\n  create(data: Record<string, unknown>): Promise<unknown>;\n  update(id: string, patch: Record<string, unknown>): Promise<unknown | null>;\n  delete(id: string): Promise<boolean>;\n}\n\nexport class ${pascal}MemoryStorage implements I${pascal}Storage {\n  private store = new Map<string, unknown>();\n\n  async getAll(): Promise<unknown[]> { return Array.from(this.store.values()); }\n  async getById(id: string): Promise<unknown | null> { return this.store.get(id) ?? null; }\n  async create(data: Record<string, unknown>): Promise<unknown> {\n    const record = { id: crypto.randomUUID(), ...data, createdAt: new Date() };\n    this.store.set(record.id as string, record);\n    return record;\n  }\n  async update(id: string, patch: Record<string, unknown>): Promise<unknown | null> {\n    const existing = this.store.get(id);\n    if (!existing) return null;\n    const updated = { ...(existing as object), ...patch, updatedAt: new Date() };\n    this.store.set(id, updated);\n    return updated;\n  }\n  async delete(id: string): Promise<boolean> { return this.store.delete(id); }\n}\n`,
    };
  },
};
