import type { RawTypeError } from './type-error-parser.ts';

export type TsErrorClass =
  | 'import_error'
  | 'type_mismatch'
  | 'missing_property'
  | 'missing_module'
  | 'generic_error'
  | 'assignment_error'
  | 'null_undefined'
  | 'other';

interface ClassifiedError {
  raw:   RawTypeError;
  class: TsErrorClass;
  label: string;
}

const CLASSIFICATIONS: Array<{ codes: number[]; class: TsErrorClass; label: string }> = [
  { codes: [2307, 2305, 2306],       class: 'missing_module',   label: 'Missing module/import' },
  { codes: [2304, 2552],             class: 'import_error',     label: 'Cannot find name/import' },
  { codes: [2322, 2345, 2339],       class: 'type_mismatch',    label: 'Type mismatch' },
  { codes: [2531, 2532, 2533, 18047], class: 'null_undefined',  label: 'Null/undefined access' },
  { codes: [2551, 2339, 2353],       class: 'missing_property', label: 'Missing property' },
  { codes: [2416, 2420, 2425],       class: 'assignment_error', label: 'Assignment incompatibility' },
];

export function classifyTsError(raw: RawTypeError): ClassifiedError {
  const codeNum = parseInt(raw.code.slice(2), 10);

  for (const entry of CLASSIFICATIONS) {
    if (entry.codes.includes(codeNum)) {
      return { raw, class: entry.class, label: entry.label };
    }
  }

  return { raw, class: 'other', label: 'TypeScript error' };
}

export function classifyAll(errors: RawTypeError[]): ClassifiedError[] {
  return errors.map(classifyTsError);
}

export function groupByClass(
  classified: ClassifiedError[],
): Record<TsErrorClass, ClassifiedError[]> {
  const groups = {} as Record<TsErrorClass, ClassifiedError[]>;
  for (const c of classified) {
    if (!groups[c.class]) groups[c.class] = [];
    groups[c.class].push(c);
  }
  return groups;
}
