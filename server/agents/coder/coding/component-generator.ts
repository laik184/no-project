/**
 * component-generator.ts
 * Generates React component file stubs.
 * Single responsibility: produce component file path + content.
 */

export interface GeneratedFile {
  relativePath: string;
  content:      string;
}

function componentTemplate(name: string): string {
  return [
    `interface ${name}Props {`,
    `  className?: string;`,
    `}`,
    ``,
    `export function ${name}({ className }: ${name}Props) {`,
    `  return (`,
    `    <div className={className}>`,
    `      <span>${name} component</span>`,
    `    </div>`,
    `  );`,
    `}`,
  ].join('\n');
}

export const componentGenerator = {
  generateReactComponent(name: string): GeneratedFile {
    const safe = name.replace(/[^a-zA-Z0-9]/g, '');
    return {
      relativePath: `client/src/components/${safe}.tsx`,
      content:      componentTemplate(safe),
    };
  },
};
