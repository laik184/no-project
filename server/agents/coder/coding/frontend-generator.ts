/**
 * frontend-generator.ts
 * Generates React frontend file stubs.
 * Single responsibility: produce file path + content for UI artifacts.
 */

export interface GeneratedFile {
  relativePath: string;
  content:      string;
}

function pageTemplate(name: string): string {
  return [
    `import { useQuery } from '@tanstack/react-query';`,
    ``,
    `export default function ${name}Page() {`,
    `  return (`,
    `    <div className="p-6">`,
    `      <h1 className="text-2xl font-bold">${name}</h1>`,
    `      <p className="text-muted-foreground mt-2">Generated page — replace with real content.</p>`,
    `    </div>`,
    `  );`,
    `}`,
  ].join('\n');
}

function layoutTemplate(name: string): string {
  return [
    `export default function ${name}Layout({ children }: { children: React.ReactNode }) {`,
    `  return <div className="min-h-screen bg-background">{children}</div>;`,
    `}`,
  ].join('\n');
}

function hookTemplate(name: string, resource: string): string {
  return [
    `import { useQuery } from '@tanstack/react-query';`,
    ``,
    `export function use${name}() {`,
    `  return useQuery({ queryKey: ['/${resource}'] });`,
    `}`,
  ].join('\n');
}

export const frontendGenerator = {
  generatePage(name: string): GeneratedFile {
    const safe = name.replace(/[^a-zA-Z0-9]/g, '');
    return {
      relativePath: `client/src/pages/${safe}Page.tsx`,
      content:      pageTemplate(safe),
    };
  },

  generateLayout(name: string): GeneratedFile {
    const safe = name.replace(/[^a-zA-Z0-9]/g, '');
    return {
      relativePath: `client/src/layouts/${safe}Layout.tsx`,
      content:      layoutTemplate(safe),
    };
  },

  generateHook(name: string, resource: string): GeneratedFile {
    const safe     = name.replace(/[^a-zA-Z0-9]/g, '');
    const resSafe  = resource.toLowerCase().replace(/[^a-z0-9]/g, '');
    return {
      relativePath: `client/src/hooks/use${safe}.ts`,
      content:      hookTemplate(safe, resSafe),
    };
  },
};
