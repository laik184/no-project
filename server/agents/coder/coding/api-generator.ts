import { apiRouterTemplate, apiTypeTemplate } from '../../coderx/templates/api-template.ts';
import { toPascalCase, toKebabCase, fileHeader } from '../../coderx/utils/code-utils.ts';

export interface GeneratedFile {
  relativePath: string;
  content:      string;
}

export const apiGenerator = {
  generateCrudEndpoints(resource: string): GeneratedFile[] {
    const kebab  = toKebabCase(resource);
    const pascal = toPascalCase(resource);

    const router  = fileHeader(`routes/${kebab}.ts`, `${pascal} CRUD endpoints`) +
      apiRouterTemplate({ resource: kebab, fields: ['id', 'name', 'createdAt'] });

    const types = fileHeader(`types/${pascal}.ts`, `${pascal} types`) +
      apiTypeTemplate(pascal, ['id', 'name', 'createdAt']);

    return [
      { relativePath: `server/routes/${kebab}.ts`, content: router },
      { relativePath: `shared/types/${pascal}.ts`, content: types },
    ];
  },
};
