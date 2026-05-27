/**
 * server/tools/coding/validation/generated-code-validator.ts
 *
 * Master validation pipeline for generated code.
 * Runs syntax → import → schema validators in sequence.
 * Dependency validation is optional (requires sandboxRoot).
 */

import { validateAllSyntax }    from './syntax-validator.ts';
import { validateAllImports }   from './import-validator.ts';
import { validateAllSchemas }   from './schema-validator.ts';
import { validateDependencies } from './dependency-validator.ts';

export interface CodeValidationReport {
  passed:   boolean;
  errors:   string[];
  warnings: string[];
  stages:   Record<string, { passed: boolean; errors: string[]; warnings: string[] }>;
}

export function validateGeneratedCode(
  files:        Record<string, string>,
  sandboxRoot?: string,
): CodeValidationReport {
  const allErrors:   string[] = [];
  const allWarnings: string[] = [];
  const stages: CodeValidationReport['stages'] = {};

  const syntax = validateAllSyntax(files);
  stages.syntax = { passed: syntax.valid, errors: syntax.errors, warnings: syntax.warnings };
  allErrors.push(...syntax.errors);
  allWarnings.push(...syntax.warnings);

  const imports = validateAllImports(files);
  stages.imports = { passed: imports.valid, errors: imports.errors, warnings: imports.warnings };
  allErrors.push(...imports.errors);
  allWarnings.push(...imports.warnings);

  const schemas = validateAllSchemas(files);
  stages.schemas = { passed: schemas.valid, errors: schemas.errors, warnings: schemas.warnings };
  allErrors.push(...schemas.errors);
  allWarnings.push(...schemas.warnings);

  if (sandboxRoot) {
    const deps = validateDependencies(files, sandboxRoot);
    stages.dependencies = { passed: deps.valid, errors: deps.errors, warnings: deps.warnings };
    allErrors.push(...deps.errors);
    allWarnings.push(...deps.warnings);
  }

  return {
    passed:   allErrors.length === 0,
    errors:   allErrors,
    warnings: allWarnings,
    stages,
  };
}
