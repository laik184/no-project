import { EventEmitter } from 'events';
import type { RuntimeEventMap, RuntimeEventName } from './runtime-events.ts';

class TerminalEventBus extends EventEmitter {
  emit<K extends RuntimeEventName>(event: K, payload: RuntimeEventMap[K]): boolean {
    return super.emit(event as string, payload);
  }

  on<K extends RuntimeEventName>(
    event: K,
    listener: (payload: RuntimeEventMap[K]) => void,
  ): this {
    return super.on(event as string, listener as (...args: any[]) => void);
  }

  once<K extends RuntimeEventName>(
    event: K,
    listener: (payload: RuntimeEventMap[K]) => void,
  ): this {
    return super.once(event as string, listener as (...args: any[]) => void);
  }

  off<K extends RuntimeEventName>(
    event: K,
    listener: (payload: RuntimeEventMap[K]) => void,
  ): this {
    return super.off(event as string, listener as (...args: any[]) => void);
  }
}

export const terminalBus = new TerminalEventBus();
terminalBus.setMaxListeners(50);

export function publishEvent<K extends RuntimeEventName>(
  event: K,
  payload: RuntimeEventMap[K],
): void {
  terminalBus.emit(event, payload);
}
