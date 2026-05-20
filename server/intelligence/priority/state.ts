import { PriorityState, TaskInput, PriorityItem } from "./types";
import { buildPriorityMap } from "./utils/sort.util";

let _state: PriorityState = Object.freeze({
  tasks: Object.freeze([]),
  evaluated: Object.freeze([]),
  priorityMap: Object.freeze({}),
  timestamp: 0,
});

export function getState(): PriorityState {
  return _state;
}

export function setTasks(tasks: readonly TaskInput[]): PriorityState {
  _state = Object.freeze({
    ..._state,
    tasks: Object.freeze([...tasks]),
    timestamp: Date.now(),
  });
  return _state;
}

export function setEvaluated(evaluated: readonly PriorityItem[]): PriorityState {
  _state = Object.freeze({
    ..._state,
    evaluated: Object.freeze([...evaluated]),
    priorityMap: buildPriorityMap(evaluated),
    timestamp: Date.now(),
  });
  return _state;
}

export function getPriorityFor(taskId: string): PriorityItem | undefined {
  return _state.priorityMap[taskId];
}

export function reset(): void {
  _state = Object.freeze({
    tasks: Object.freeze([]),
    evaluated: Object.freeze([]),
    priorityMap: Object.freeze({}),
    timestamp: 0,
  });
}
