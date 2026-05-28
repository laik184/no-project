/**
 * server/tools/coding/templates/react-template.ts
 *
 * Template-based React code generators.
 * All functions are pure and synchronous.
 */

import { toPascalCase, toKebabCase } from '../../shared/string-utils.ts';

export function reactPageTemplate(name: string, content?: string): string {
  const Name = toPascalCase(name);
  const body = content ?? `      <h1 className="text-2xl font-bold">${Name}</h1>`;
  return `import type { FC } from 'react';

const ${Name}Page: FC = () => {
  return (
    <main className="container mx-auto px-4 py-8">
${body}
    </main>
  );
};

export default ${Name}Page;
`;
}

export function reactLayoutTemplate(name: string, slots: string[] = ['children']): string {
  const Name = toPascalCase(name);
  const slotProps = slots.map(s => `  ${s}: React.ReactNode;`).join('\n');
  const slotJsx   = slots.map(s => `        <section className="${s}-slot">{${s}}</section>`).join('\n');
  return `import type { FC } from 'react';

interface ${Name}LayoutProps {
${slotProps}
}

const ${Name}Layout: FC<${Name}LayoutProps> = ({ ${slots.join(', ')} }) => {
  return (
    <div className="${toKebabCase(name)}-layout flex flex-col min-h-screen">
${slotJsx}
    </div>
  );
};

export default ${Name}Layout;
`;
}

export function reactHookTemplate(name: string, returnType = 'unknown', body?: string): string {
  const hookName = name.startsWith('use') ? name : `use${toPascalCase(name)}`;
  const impl = body ?? `  // TODO: implement ${hookName}\n  return undefined as unknown as ${returnType};`;
  return `import { useState, useEffect } from 'react';

export function ${hookName}(): ${returnType} {
${impl}
}
`;
}

export function reactContextTemplate(name: string, fields: string[] = []): string {
  const Name = toPascalCase(name);
  const stateFields = fields.length
    ? fields.map(f => `  ${f}: string;`).join('\n')
    : '  value: string;';
  const defaults = fields.length
    ? fields.map(f => `    ${f}: '',`).join('\n')
    : '    value: \'\',';
  return `import { createContext, useContext, useState, type FC, type ReactNode } from 'react';

interface ${Name}State {
${stateFields}
}

interface ${Name}ContextValue extends ${Name}State {
  setState: React.Dispatch<React.SetStateAction<${Name}State>>;
}

const ${Name}Context = createContext<${Name}ContextValue | null>(null);

const defaultState: ${Name}State = {
${defaults}
};

export const ${Name}Provider: FC<{ children: ReactNode }> = ({ children }) => {
  const [state, setState] = useState<${Name}State>(defaultState);
  return (
    <${Name}Context.Provider value={{ ...state, setState }}>
      {children}
    </${Name}Context.Provider>
  );
};

export function use${Name}(): ${Name}ContextValue {
  const ctx = useContext(${Name}Context);
  if (!ctx) throw new Error('use${Name} must be used inside ${Name}Provider');
  return ctx;
}
`;
}

export function reactRoutingTemplate(
  routes: Array<{ path: string; component: string }>,
): string {
  const imports = routes
    .map(r => `import ${r.component} from './pages/${toKebabCase(r.component)}.tsx';`)
    .join('\n');
  const routeJsx = routes
    .map(r => `      <Route path="${r.path}" component={${r.component}} />`)
    .join('\n');
  return `import { Switch, Route } from 'wouter';
${imports}

export default function AppRoutes(): JSX.Element {
  return (
    <Switch>
${routeJsx}
      <Route>
        <div className="p-8 text-center">404 — Page not found</div>
      </Route>
    </Switch>
  );
}
`;
}

export function tailwindUITemplate(
  name: string,
  variant: 'card' | 'button' | 'input' | 'badge' | 'alert' = 'card',
): string {
  const Name = toPascalCase(name);
  const bodies: Record<typeof variant, string> = {
    card:   `<div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">\n      {children}\n    </div>`,
    button: `<button type="button" className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50" {...props}>{children}</button>`,
    input:  `<input className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white" {...props} />`,
    badge:  `<span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-900 dark:text-blue-200">{children}</span>`,
    alert:  `<div role="alert" className="rounded-md border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-800 dark:border-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-200">{children}</div>`,
  };
  return `import type { FC, ReactNode, ComponentProps } from 'react';

interface ${Name}Props extends ComponentProps<'div'> {
  children?: ReactNode;
}

export const ${Name}: FC<${Name}Props> = ({ children, ...props }) => {
  return (
    ${bodies[variant]}
  );
};

export default ${Name};
`;
}
