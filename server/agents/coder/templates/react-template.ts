import { fileHeader, toPascalCase, toKebabCase } from '../utils/code-utils.ts';

export function generateReactApp(appName: string): string {
  const name = toPascalCase(appName);
  return `${fileHeader(`${name} — React application entry point`)}import { Switch, Route } from 'wouter';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import HomePage from './pages/Home';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Switch>
        <Route path="/" component={HomePage} />
      </Switch>
      <Toaster />
    </QueryClientProvider>
  );
}
`;
}

export function generateReactPage(pageName: string): string {
  const name = toPascalCase(pageName);
  return `${fileHeader(`${name} page`)}export default function ${name}Page() {
  return (
    <main className="container mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">${name}</h1>
    </main>
  );
}
`;
}

export function generateReactLayout(layoutName: string): string {
  const name = toPascalCase(layoutName);
  return `${fileHeader(`${name} layout`)}import type { ReactNode } from 'react';

interface ${name}LayoutProps {
  children: ReactNode;
}

export default function ${name}Layout({ children }: ${name}LayoutProps) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b px-6 py-4">
        <span className="font-semibold">${name}</span>
      </header>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
`;
}

export function generateReactHook(hookName: string, resourceName: string): string {
  const hook   = `use${toPascalCase(hookName)}`;
  const path   = toKebabCase(resourceName);
  return `${fileHeader(`${hook} — data hook for ${resourceName}`)}import { useQuery } from '@tanstack/react-query';

export function ${hook}() {
  return useQuery<unknown[]>({
    queryKey: ['/api/${path}'],
  });
}
`;
}
