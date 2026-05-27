export type ExecutorEventName =
  | 'execution.started'
  | 'execution.step.started'
  | 'execution.step.completed'
  | 'execution.failed'
  | 'execution.completed';

export interface ExecutionStartedPayload {
  runId:      string;
  sessionId:  string;
  tasksTotal: number;
  timestamp:  Date;
}

export interface ExecutionStepStartedPayload {
  runId:   string;
  taskId:  string;
  stepId:  string;
  stepType:string;
  label:   string;
  timestamp: Date;
}

export interface ExecutionStepCompletedPayload {
  runId:      string;
  taskId:     string;
  stepId:     string;
  stepType:   string;
  success:    boolean;
  durationMs: number;
  filePath?:  string;
  timestamp:  Date;
}

export interface ExecutionFailedPayload {
  runId:     string;
  taskId?:   string;
  error:     string;
  timestamp: Date;
}

export interface ExecutionCompletedPayload {
  runId:          string;
  tasksCompleted: number;
  tasksFailed:    number;
  durationMs:     number;
  timestamp:      Date;
}

export interface ExecutorEventMap {
  'execution.started':        ExecutionStartedPayload;
  'execution.step.started':   ExecutionStepStartedPayload;
  'execution.step.completed': ExecutionStepCompletedPayload;
  'execution.failed':         ExecutionFailedPayload;
  'execution.completed':      ExecutionCompletedPayload;
}
