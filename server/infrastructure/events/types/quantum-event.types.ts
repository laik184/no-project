/**
 * server/infrastructure/events/types/quantum-event.types.ts
 *
 * Quantum-layer event payload interfaces:
 * distributed scanner, memory write safety, DAG aggregation.
 * Zero local imports — no circular-dependency risk.
 */

/**
 * Emitted by the Distributed File Scanner for all scan lifecycle phases.
 */
export interface QuantumScanEvent {
  scanId:          string;
  projectId:       number;
  trigger?:        string;
  rootPath?:       string;
  fileCount?:      number;
  partitionCount?: number;
  partitionId?:    string;
  workerIndex?:    number;
  durationMs?:     number;
  findingCount?:   number;
  error?:          string;
  ts:              number;
}

/**
 * Emitted by the Memory Write Safety System for all write lifecycle phases.
 */
export interface MemoryWriteEvent {
  requestId:   string;
  filePath:    string;
  ownerId:     string;
  runId:       string;
  fileType?:   string;
  durationMs?: number;
  retries?:    number;
  checksum?:   string;
  lockId?:     string;
  error?:      string;
  ts:          number;
}

/**
 * Emitted by the DAG-Wave Result Aggregation Layer.
 */
export interface QuantumAggregationEvent {
  runId:          string;
  projectId:      number;
  waveIndex:      number;
  nodeCount?:     number;
  durationMs?:    number;
  conflictCount?: number;
  conflictKind?:  string;
  filePath?:      string;
  safe?:          boolean;
  reason?:        string;
  ts:             number;
}
