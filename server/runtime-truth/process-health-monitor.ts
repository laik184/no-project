import { probePort } from '../runtime/health/port-probe.ts';

export class ProcessHealthMonitor {
  constructor(private port?: number) {}

  async check(): Promise<{ alive: boolean; portOpen: boolean }> {
    const portOpen = this.port ? await probePort(this.port) : false;
    return { alive: portOpen, portOpen };
  }
}
