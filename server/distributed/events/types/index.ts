export interface DistributedEvent {
  id:         string;
  channel:    string;
  eventType:  string;
  runId:      string;
  projectId:  number;
  payload:    unknown;
  correlationId?: string;
  ts:         number;
  replayable: boolean;
}

export interface SubscriptionOptions {
  channel:     string;
  handler:     (event: DistributedEvent) => void | Promise<void>;
  filter?:     (event: DistributedEvent) => boolean;
  maxRetries?: number;
}

export interface EventPartitionKey {
  channel:   string;
  projectId: number;
}

export type DistributedEventType =
  | "event.published"
  | "event.delivered"
  | "event.dropped"
  | "event.replayed"
  | "event.subscribed"
  | "event.unsubscribed";
