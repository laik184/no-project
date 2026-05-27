import {
  reactComponentTemplate,
  reactPageTemplate,
} from '../../coderx/templates/react-template.ts';
import { toPascalCase, toKebabCase } from '../../coderx/utils/code-utils.ts';

export interface GeneratedFile {
  relativePath: string;
  content:      string;
}

export const frontendGenerator = {
  generatePage(name: string): GeneratedFile {
    const pascal  = toPascalCase(name);
    const kebab   = toKebabCase(name);
    return {
      relativePath: `client/src/pages/${pascal}Page.tsx`,
      content:      reactPageTemplate(name),
    };
  },

  generateLayout(name: string): GeneratedFile {
    const pascal = toPascalCase(name);
    const kebab  = toKebabCase(name);
    const content = reactComponentTemplate({ componentName: pascal, hasProps: false });
    return {
      relativePath: `client/src/layouts/${pascal}Layout.tsx`,
      content,
    };
  },

  generateHook(name: string, _returnType: string): GeneratedFile {
    const hookName = name.startsWith('use') ? name : `use${toPascalCase(name)}`;
    const content  = `import { useState, useEffect } from 'react';

export function ${hookName}() {
  const [data, setData] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return { data, loading, error };
}
`;
    return {
      relativePath: `client/src/hooks/${hookName}.ts`,
      content,
    };
  },
};
