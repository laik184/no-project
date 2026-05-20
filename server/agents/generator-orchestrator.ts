export interface GeneratorOrchestrator {
  run(input: unknown): Promise<unknown>;
}

class GeneratorOrchestratorImpl implements GeneratorOrchestrator {
  async run(input: unknown): Promise<unknown> {
    return { ok: true, input };
  }
}

export const generatorOrchestrator: GeneratorOrchestrator = new GeneratorOrchestratorImpl();
