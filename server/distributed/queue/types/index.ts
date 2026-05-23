import type { TaskPriorityLevel } from "../priority-queue.ts";

export interface DistributedJobData {
  taskId:     string;
  runId:      string;
  projectId:  number;
  workerType: string;
  priority:   TaskPriorityLevel;
  tags?:      string[];
  payload:    unknown;
  timeoutMs:  number;
  enqueuedAt: number;
}

export interface DistributedJobResult<T = unknown> {
  taskId:     string;
  success:    boolean;
  output?:    T;
  error?:     string;
  durationMs: number;
  attempts:   number;
  workerId:   string;
}

export interface QueueStats {
  waiting:    number;
  active:     number;
  completed:  number;
  failed:     number;
  delayed:    number;
  paused:     boolean;
}

export type QueueEventType =
  | "queue.enqueued"
  | "queue.dequeued"
  | "queue.completed"
  | "queue.failed"
  | "queue.retried"
  | "queue.dead_letter"
  | "queue.backpressure"
  | "queue.drained"
  | "queue.stalled";
