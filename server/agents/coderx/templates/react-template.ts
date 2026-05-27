import { toPascalCase } from '../utils/code-utils.ts';

export interface ReactTemplateOptions {
  componentName: string;
  hasProps?: boolean;
  propsInterface?: string;
  children?: string;
}

export function reactComponentTemplate(opts: ReactTemplateOptions): string {
  const name = toPascalCase(opts.componentName);
  const propsType = opts.hasProps ? `${name}Props` : 'Record<string, never>';

  const propsBlock = opts.hasProps && opts.propsInterface
    ? `interface ${name}Props {\n${opts.propsInterface}\n}\n\n`
    : opts.hasProps
      ? `interface ${name}Props {}\n\n`
      : '';

  const body = opts.children ?? `  return (\n    <div className="${name.toLowerCase()}-container">\n      <h1>${name}</h1>\n    </div>\n  );`;

  return `import React from 'react';

${propsBlock}export function ${name}(${opts.hasProps ? `props: ${propsType}` : ''}): React.ReactElement {
${body}
}

export default ${name};
`;
}

export function reactPageTemplate(pageName: string, content?: string): string {
  const name = toPascalCase(pageName);
  const body = content ?? `      <h1>${name}</h1>\n      <p>Welcome to ${name}</p>`;
  return `import React from 'react';

export function ${name}Page(): React.ReactElement {
  return (
    <main className="page ${pageName.toLowerCase()}-page">
${body}
    </main>
  );
}

export default ${name}Page;
`;
}

export function reactHookTemplate(hookName: string, returnType: string, body: string): string {
  const name = hookName.startsWith('use') ? hookName : `use${toPascalCase(hookName)}`;
  return `import { useState, useEffect } from 'react';

export function ${name}(): ${returnType} {
${body}
}
`;
}
