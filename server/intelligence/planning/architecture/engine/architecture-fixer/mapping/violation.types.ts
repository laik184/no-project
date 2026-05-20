export interface RawViolation {
  readonly id: string;
  readonly type: string;
  readonly severity: string;
  readonly file: string;
  readonly description?: string;
  readonly filePath?: string;
  readonly line?: number;
  readonly target?: string;
  readonly source?: string;
  readonly importedFile?: string;
  readonly rule?: string;
  readonly evidence?: readonly string[];
  readonly details?: Readonly<Record<string, unknown>>;
}
