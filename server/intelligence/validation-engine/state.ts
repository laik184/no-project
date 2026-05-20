import { ValidationState, ValidationRecord } from "./types";

const MAX_HISTORY = 200;

let _state: ValidationState = Object.freeze({
  totalValidations: 0,
  failureCount: 0,
  lastScore: 0,
  history: Object.freeze([]),
});

export function getState(): ValidationState {
  return _state;
}

export function recordValidation(record: ValidationRecord): ValidationState {
  const history = [..._state.history, Object.freeze(record)].slice(-MAX_HISTORY);
  _state = Object.freeze({
    totalValidations: _state.totalValidations + 1,
    failureCount: _state.failureCount + (record.success ? 0 : 1),
    lastScore: record.score,
    history: Object.freeze(history),
  });
  return _state;
}

export function getSuccessRate(): number {
  if (_state.totalValidations === 0) return 1;
  const successes = _state.totalValidations - _state.failureCount;
  return Math.round((successes / _state.totalValidations) * 100) / 100;
}

export function getAverageScore(): number {
  if (_state.history.length === 0) return 0;
  const total = _state.history.reduce((sum, r) => sum + r.score, 0);
  return Math.round(total / _state.history.length);
}
