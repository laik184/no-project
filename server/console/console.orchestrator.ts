interface ConsoleHealth {
  status: 'ready' | 'error';
  modules: Record<string, string>;
}

class ConsoleOrchestrator {
  private _ready = false;

  init(): void {
    this._ready = true;
  }

  getHealth(): ConsoleHealth {
    return {
      status: this._ready ? 'ready' : 'error',
      modules: { stream: 'ready', persist: 'ready', history: 'ready' },
    };
  }
}

export const consoleOrchestrator = new ConsoleOrchestrator();
