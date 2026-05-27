import { fileHeader, toPascalCase, toKebabCase } from '../utils/code-utils.ts';
import {
  generateReactPage,
  generateReactLayout,
  generateReactHook,
} from '../templates/react-template.ts';

export interface FrontendGenOptions {
  name:     string;
  type:     'page' | 'component' | 'layout' | 'hook';
  props?:   string[];
  route?:   string;
}

export interface GeneratedFile {
  relativePath: string;
  content:      string;
}

export const frontendGenerator = {
  generatePage(name: string): GeneratedFile {
    const kebab = toKebabCase(name);
    return {
      relativePath: `src/pages/${toPascalCase(name)}.tsx`,
      content:      generateReactPage(name),
    };
  },

  generateComponent(name: string, props: string[] = []): GeneratedFile {
    const pascal = toPascalCase(name);
    const propsType = props.length > 0
      ? `interface ${pascal}Props {\n${props.map((p) => `  ${p}: string;`).join('\n')}\n}\n\n`
      : '';
    const propsArg = props.length > 0 ? `{ ${props.join(', ')} }: ${pascal}Props` : '_props: object';

    return {
      relativePath: `src/components/${pascal}.tsx`,
      content:      `${fileHeader(`${pascal} component`)}${propsType}export function ${pascal}(${propsArg}) {\n  return (\n    <div className="flex flex-col gap-2">\n      <span>${pascal}</span>\n    </div>\n  );\n}\n`,
    };
  },

  generateLayout(name: string): GeneratedFile {
    return {
      relativePath: `src/layouts/${toPascalCase(name)}Layout.tsx`,
      content:      generateReactLayout(name),
    };
  },

  generateHook(name: string, resource: string): GeneratedFile {
    const hook = `use${toPascalCase(name)}`;
    return {
      relativePath: `src/hooks/${hook}.ts`,
      content:      generateReactHook(name, resource),
    };
  },

  generateIndex(components: string[]): GeneratedFile {
    const exports = components
      .map((c) => `export { ${toPascalCase(c)} } from './${toPascalCase(c)}';`)
      .join('\n');
    return {
      relativePath: 'src/components/index.ts',
      content:      `${fileHeader('Component barrel exports')}\n${exports}\n`,
    };
  },
};
