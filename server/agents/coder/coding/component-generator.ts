import { reactComponentTemplate } from '../../coderx/templates/react-template.ts';
import { toPascalCase, toKebabCase } from '../../coderx/utils/code-utils.ts';

export interface GeneratedFile {
  relativePath: string;
  content:      string;
}

export const componentGenerator = {
  generateReactComponent(name: string): GeneratedFile {
    const pascal  = toPascalCase(name);
    const kebab   = toKebabCase(name);
    const content = reactComponentTemplate({ componentName: pascal, hasProps: true });

    return {
      relativePath: `client/src/components/${pascal}.tsx`,
      content,
    };
  },
};
