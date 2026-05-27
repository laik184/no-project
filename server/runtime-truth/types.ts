export type VerificationStage =
  | 'typescript'
  | 'imports'
  | 'runtime'
  | 'http'
  | 'preview'
  | 'dependencies';

export interface StageResult {
  stage:     VerificationStage;
  passed:    boolean;
  durationMs: number;
  details?:  string;
  error?:    string;
}

export interface VerificationReport {
  projectId:    number;
  passed:       boolean;
  stages:       StageResult[];
  evidence:     Record<string, unknown>;
  recoverySignal?: string;
  durationMs:   number;
  ts:           number;
}

export interface RuntimeHealthState {
  projectId: number;
  healthy:   boolean;
  port?:     number;
  uptime?:   number;
  lastCheck: number;
}

export interface VerificationOptions {
  projectId:     number;
  workspacePath: string;
  port?:         number;
  previewUrl?:   string;
  skipStages?:   VerificationStage[];
  timeoutMs?:    number;
}
