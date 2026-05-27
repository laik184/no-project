export interface OutputValidationResult {
  valid:    boolean;
  reasons:  string[];
}

const ERROR_SIGNALS = [/error TS\d+/i, /SyntaxError/, /ReferenceError/, /Cannot find module/];
const SUCCESS_SIGNALS = [/Build complete/i, /compiled successfully/i, /done in/i];

export function validateOutput(output: string): OutputValidationResult {
  const reasons: string[] = [];
  for (const p of ERROR_SIGNALS) {
    if (p.test(output)) reasons.push(`Error pattern matched: ${p.source}`);
  }
  return { valid: reasons.length === 0, reasons };
}

export function hasSuccessSignal(output: string): boolean {
  return SUCCESS_SIGNALS.some(p => p.test(output));
}

export function validateGeneratedCode(
  type:    string,
  content: string,
): OutputValidationResult {
  const reasons: string[] = [];
  if (!content?.trim()) {
    reasons.push(`Generated ${type} content is empty`);
    return { valid: false, reasons };
  }
  for (const p of ERROR_SIGNALS) {
    if (p.test(content)) reasons.push(`Error pattern in ${type}: ${p.source}`);
  }
  return { valid: reasons.length === 0, reasons };
}

export function validateCommandOutput(
  exitCode: number,
  stdout:   string,
  stderr:   string,
): OutputValidationResult {
  const reasons: string[] = [];
  if (exitCode !== 0) reasons.push(`Non-zero exit code: ${exitCode}`);
  for (const p of ERROR_SIGNALS) {
    if (p.test(stderr)) reasons.push(`Error in stderr: ${p.source}`);
  }
  return { valid: reasons.length === 0, reasons };
}
