export type LspLanguage =
  | "typescript"
  | "javascript"
  | "python"
  | "rust"
  | "go"
  | "java"
  | "cpp"
  | "css"
  | "html"
  | "json"
  | "yaml";

export interface LspServer {
  language: LspLanguage;
  command: string;
  args: string[];
  rootUri: string;
  pid?: number;
  status: "starting" | "running" | "stopped" | "error";
}

export interface LspDiagnostic {
  uri: string;
  range: LspRange;
  severity: 1 | 2 | 3 | 4;  // error | warn | info | hint
  code?: string | number;
  source?: string;
  message: string;
}

export interface LspRange {
  start: { line: number; character: number };
  end:   { line: number; character: number };
}

export interface LspCompletionItem {
  label: string;
  kind?: number;
  detail?: string;
  documentation?: string;
  insertText?: string;
  sortText?: string;
}

export interface LspHover {
  contents: string;
  range?: LspRange;
}

export interface LspDefinition {
  uri: string;
  range: LspRange;
}

export interface LspRenameResult {
  changes: Record<string, Array<{ range: LspRange; newText: string }>>;
}

export interface LspSymbol {
  name: string;
  kind: number;
  location: { uri: string; range: LspRange };
  containerName?: string;
}

export interface LspFormatEdit {
  range: LspRange;
  newText: string;
}
