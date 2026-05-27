import { toKebabCase, toPascalCase } from '../utils/code-utils.ts';
import {
  generateApiRoute,
  generateRequestHandler,
  generateResponseSchema,
} from '../templates/api-template.ts';

export interface GeneratedFile {
  relativePath: string;
  content:      string;
}

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface EndpointSpec {
  method:      HttpMethod;
  path:        string;
  description: string;
}

export const apiGenerator = {
  generateEndpoint(spec: EndpointSpec): GeneratedFile {
    const slug = spec.path.replace(/[/:]/g, '-').replace(/^-/, '');
    return {
      relativePath: `server/api/${spec.method.toLowerCase()}-${slug}.handler.ts`,
      content:      generateApiRoute(spec.method, spec.path, spec.description),
    };
  },

  generateRequestHandler(resourceName: string, action: string): GeneratedFile {
    const pascal = toPascalCase(resourceName);
    const kebab  = toKebabCase(resourceName);
    return {
      relativePath: `server/handlers/${kebab}-${action}.handler.ts`,
      content:      generateRequestHandler(resourceName, action),
    };
  },

  generateResponseSchema(resourceName: string): GeneratedFile {
    return {
      relativePath: `server/schemas/${toKebabCase(resourceName)}.schema.ts`,
      content:      generateResponseSchema(resourceName),
    };
  },

  generateCrudEndpoints(resourceName: string): GeneratedFile[] {
    const kebab = toKebabCase(resourceName);
    const basePath = `/api/${kebab}s`;

    const specs: EndpointSpec[] = [
      { method: 'GET',    path: basePath,       description: `List all ${resourceName}s` },
      { method: 'GET',    path: `${basePath}/:id`, description: `Get ${resourceName} by ID` },
      { method: 'POST',   path: basePath,       description: `Create ${resourceName}` },
      { method: 'PUT',    path: `${basePath}/:id`, description: `Update ${resourceName}` },
      { method: 'DELETE', path: `${basePath}/:id`, description: `Delete ${resourceName}` },
    ];

    return specs.map((spec) => apiGenerator.generateEndpoint(spec));
  },
};
