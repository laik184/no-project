import { runtimeManager } from '../../infrastructure/runtime/runtime-manager.ts';

const observed = new Set<number>();
let timer: NodeJS.Timeout | null = null;

async function probe(): Promise<void> {
  try {
    const all = (runtimeManager as any).listAll?.() ?? [];
    for (const e of all) {
      if (e?.projectId != null) observed.add(e.projectId);
    }
  } catch { /* best-effort */ }
}

export const observationController = {
  start(): void {
    if (timer) return;
    probe().catch(() => {});
    timer = setInterval(() => probe().catch(() => {}), 15_000);
  },
  stop(): void {
    if (timer) { clearInterval(timer); timer = null; }
    observed.clear();
  },
  observe(projectId: number):   void    { observed.add(projectId); },
  unobserve(projectId: number): void    { observed.delete(projectId); },
  isObserving(projectId: number): boolean { return observed.has(projectId); },
  observedProjects(): number[]  { return [...observed]; },
};
