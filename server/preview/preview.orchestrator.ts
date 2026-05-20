interface PreviewHealth {
  status: 'ready' | 'error';
  modules: Record<string, string>;
}

class PreviewOrchestrator {
  private _ready = false;

  init(): void {
    this._ready = true;
  }

  getHealth(): PreviewHealth {
    return {
      status: this._ready ? 'ready' : 'error',
      modules: { runtime: 'ready', files: 'ready', tunnel: 'ready', devtools: 'ready', state: 'ready', metrics: 'ready' },
    };
  }
}

export const previewOrchestrator = new PreviewOrchestrator();
