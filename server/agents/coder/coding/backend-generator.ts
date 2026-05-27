import { fileHeader, toCamelCase, toPascalCase, toKebabCase } from '../utils/code-utils.ts';
import {
  generateExpressRoute,
  generateMiddleware,
} from '../templates/express-template.ts';

export interface GeneratedFile {
  relativePath: string;
  content:      string;
}

export const backendGenerator = {
  generateRoute(resourceName: string): GeneratedFile {
    const kebab = toKebabCase(resourceName);
    return {
      relativePath: `server/routes/${kebab}.routes.ts`,
      content:      generateExpressRoute(resourceName),
    };
  },

  generateController(resourceName: string): GeneratedFile {
    const pascal = toPascalCase(resourceName);
    const camel  = toCamelCase(resourceName);

    return {
      relativePath: `server/controllers/${toKebabCase(resourceName)}.controller.ts`,
      content:      `${fileHeader(`${pascal} controller`)}export const ${camel}Controller = {\n  async getAll(): Promise<unknown[]> {\n    return [];\n  },\n\n  async getById(id: string): Promise<unknown | null> {\n    return { id };\n  },\n\n  async create(data: Record<string, unknown>): Promise<unknown> {\n    return { id: crypto.randomUUID(), ...data };\n  },\n\n  async update(id: string, data: Record<string, unknown>): Promise<unknown | null> {\n    return { id, ...data };\n  },\n\n  async remove(id: string): Promise<boolean> {\n    void id;\n    return true;\n  },\n};\n`,
    };
  },

  generateService(resourceName: string): GeneratedFile {
    const pascal = toPascalCase(resourceName);
    const camel  = toCamelCase(resourceName);

    return {
      relativePath: `server/services/${toKebabCase(resourceName)}.service.ts`,
      content:      `${fileHeader(`${pascal} service — business logic layer`)}export class ${pascal}Service {\n  async findAll(): Promise<unknown[]> {\n    return [];\n  }\n\n  async findById(id: string): Promise<unknown | null> {\n    return { id };\n  }\n\n  async create(data: Record<string, unknown>): Promise<unknown> {\n    return { id: crypto.randomUUID(), ...data, createdAt: new Date() };\n  }\n\n  async update(id: string, patch: Record<string, unknown>): Promise<unknown | null> {\n    return { id, ...patch, updatedAt: new Date() };\n  }\n\n  async delete(id: string): Promise<boolean> {\n    void id;\n    return true;\n  }\n}\n\nexport const ${camel}Service = new ${pascal}Service();\n`,
    };
  },

  generateMiddleware(name: string): GeneratedFile {
    return {
      relativePath: `server/middleware/${toKebabCase(name)}.ts`,
      content:      generateMiddleware(name),
    };
  },
};
