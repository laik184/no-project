import type { ParsedError } from '../types.ts';
import { parseLines } from '../utils.ts';

const TS_ERROR_PATTERN = /^(.+?)\((\d+),(\d+)\):\s*error\s+(TS\d+):\s*(.+)$/;
const TS_WARN_PATTERN  = /^(.+?)\((\d+),(\d+)\):\s*warning\s+(TS\d+):\s*(.+)$/;

export interface RawTypeError {
  file: string; line: number; column: number; code: string; message: string; isError: boolean;
}

export function parseTscOutput(output: string): RawTypeError[] {
  const lines  = parseLines(output);
  const errors: RawTypeError[] = [];
  for (const line of lines) {
    const errMatch = line.match(TS_ERROR_PATTERN);
    if (errMatch) {
      errors.push({ file: errMatch[1], line: parseInt(errMatch[2], 10), column: parseInt(errMatch[3], 10), code: errMatch[4], message: errMatch[5], isError: true });
      continue;
    }
    const warnMatch = line.match(TS_WARN_PATTERN);
    if (warnMatch) {
      errors.push({ file: warnMatch[1], line: parseInt(warnMatch[2], 10), column: parseInt(warnMatch[3], 10), code: warnMatch[4], message: warnMatch[5], isError: false });
    }
  }
  return errors;
}

export function rawToParseError(raw: RawTypeError): ParsedError {
  return {
    message:  raw.message,
    severity: raw.isError ? 'error' : 'warning',
    category: 'typecheck',
    file:     raw.file,
    line:     raw.line,
    column:   raw.column,
    code:     raw.code,
    raw:      `${raw.file}(${raw.line},${raw.column}): ${raw.code}: ${raw.message}`,
  };
}

export function extractErrorCount(output: string): number {
  const m = output.match(/Found (\d+) error/);
  return m ? parseInt(m[1], 10) : 0;
}

export type TsErrorClass =
  | 'import_error' | 'type_mismatch' | 'missing_property'
  | 'missing_module' | 'generic_error' | 'assignment_error' | 'null_undefined' | 'other';

export interface ClassifiedError { raw: RawTypeError; class: TsErrorClass; label: string; }

const CLASSIFICATIONS: Array<{ codes: number[]; class: TsErrorClass; label: string }> = [
  { codes: [2307, 2305, 2306],        class: 'missing_module',   label: 'Missing module/import'       },
  { codes: [2304, 2552],              class: 'import_error',     label: 'Cannot find name/import'     },
  { codes: [2322, 2345, 2339],        class: 'type_mismatch',    label: 'Type mismatch'               },
  { codes: [2531, 2532, 2533, 18047], class: 'null_undefined',   label: 'Null/undefined access'       },
  { codes: [2551, 2339, 2353],        class: 'missing_property', label: 'Missing property'            },
  { codes: [2416, 2420, 2425],        class: 'assignment_error', label: 'Assignment incompatibility'  },
];

export function classifyTsError(raw: RawTypeError): ClassifiedError {
  const codeNum = parseInt(raw.code.slice(2), 10);
  for (const entry of CLASSIFICATIONS) {
    if (entry.codes.includes(codeNum)) return { raw, class: entry.class, label: entry.label };
  }
  return { raw, class: 'other', label: 'TypeScript error' };
}

export function classifyAll(errors: RawTypeError[]): ClassifiedError[] {
  return errors.map(classifyTsError);
}

export function groupByClass(classified: ClassifiedError[]): Record<TsErrorClass, ClassifiedError[]> {
  const groups = {} as Record<TsErrorClass, ClassifiedError[]>;
  for (const c of classified) {
    if (!groups[c.class]) groups[c.class] = [];
    groups[c.class].push(c);
  }
  return groups;
}

export interface TypecheckReport {
  passed: boolean; errorCount: number; warningCount: number;
  summary: string; byClass: Partial<Record<string, ClassifiedError[]>>; topErrors: string[];
}

export function buildTypecheckReport(rawErrors: RawTypeError[], exitCode: number): TypecheckReport {
  const classified = classifyAll(rawErrors);
  const byClass    = groupByClass(classified);
  const errors     = rawErrors.filter((e) => e.isError);
  const warnings   = rawErrors.filter((e) => !e.isError);
  const passed     = exitCode === 0 && errors.length === 0;
  const topErrors  = errors.slice(0, 5).map((e) => `${e.file}(${e.line}): ${e.code} — ${e.message}`);
  const summary    = passed
    ? 'TypeScript check passed with no errors'
    : `${errors.length} type error(s), ${warnings.length} warning(s)`;
  return { passed, errorCount: errors.length, warningCount: warnings.length, summary, byClass, topErrors };
}

export function formatTypecheckReport(report: TypecheckReport): string {
  const lines = [
    `TypeScript Check: ${report.passed ? 'PASSED' : 'FAILED'}`,
    `Errors: ${report.errorCount}  Warnings: ${report.warningCount}`,
  ];
  if (report.topErrors.length) {
    lines.push('', 'Top errors:');
    report.topErrors.forEach((e) => lines.push(`  ${e}`));
  }
  return lines.join('\n');
}
