import { ExecutionStatus, MigrationLog } from './types.js';

export interface MigrationRunnerState {
  executionId: string;
  migrations: string[];
  executed: string[];
  failed: string[];
  status: ExecutionStatus;
  logs: MigrationLog[];
  errors: string[];
}

const emptyState: MigrationRunnerState = Object.freeze({
  executionId: '',
  migrations: [],
  executed: [],
  failed: [],
  status: 'IDLE',
  logs: [],
  errors: [],
});

let currentState: MigrationRunnerState = emptyState;

export const initializeState = (executionId: string): MigrationRunnerState => {
  currentState = Object.freeze({
    executionId,
    migrations: [],
    executed: [],
    failed: [],
    status: 'RUNNING' as const,
    logs: [],
    errors: [],
  });

  return currentState;
};

export const setState = (nextState: MigrationRunnerState): MigrationRunnerState => {
  currentState = Object.freeze({
    ...nextState,
    migrations: [...nextState.migrations],
    executed: [...nextState.executed],
    failed: [...nextState.failed],
    logs: [...nextState.logs],
    errors: [...nextState.errors],
  });

  return currentState;
};

export const getExecutionStatus = (): MigrationRunnerState => currentState;
