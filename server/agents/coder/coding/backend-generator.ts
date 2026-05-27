import {
  expressRouterTemplate,
  expressServerTemplate,
} from '../../coderx/templates/express-template.ts';
import { toKebabCase, toCamelCase, fileHeader } from '../../coderx/utils/code-utils.ts';

export interface GeneratedFile {
  relativePath: string;
  content:      string;
}

export const backendGenerator = {
  generateRoute(name: string): GeneratedFile {
    const kebab   = toKebabCase(name);
    const prefix  = `/${kebab}`;
    const content = fileHeader(`routes/${kebab}.ts`, `${name} router`) +
      expressRouterTemplate({ prefix, middlewares: [] });

    return {
      relativePath: `server/routes/${kebab}.ts`,
      content,
    };
  },

  generateServer(port = 3001): GeneratedFile {
    const content = fileHeader('server.ts', 'Express entry point') +
      expressServerTemplate(port, []);
    return {
      relativePath: 'server/main.ts',
      content,
    };
  },
};
