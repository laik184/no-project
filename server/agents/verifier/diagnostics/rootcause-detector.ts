import type { ParsedError, RootCause, FailureCategory } from '../types/diagnostics.types.ts';
import { groupByCategory } from './failure-classifier.ts';

const FIX_SUGGESTIONS: Partial<Record<FailureCategory, string>> = {
  typecheck: 'Run `tsc --noEmit` to inspect all type errors. Check import paths and type annotations.',
  build:     'Inspect build config (vite.config.ts / tsconfig.json). Ensure all dependencies are installed.',
  runtime:   'Ensure all required env vars are set. Verify module paths and node_modules installation.',
  test:      'Check test setup. Inspect failing assertions and ensure test database/mocks are initialized.',
  network:   'Verify server is listening on the expected port. Check firewall / CORS settings.',
  config:    'Ensure .env file is present. Verify all required environment variables are set.',
  unknown:   'Inspect full output logs. Enable verbose logging to locate the root issue.',
};

export function detectRootCauses(errors: ParsedError[]): RootCause[] {
  const groups = groupByCategory(errors);
  const causes: RootCause[] = [];

  for (const [category, categoryErrors] of Object.entries(groups) as [FailureCategory, ParsedError[]][]) {
    const primary      = categoryErrors[0];
    const related      = categoryErrors.slice(1).map((e) => e.message);
    const suggestedFix = FIX_SUGGESTIONS[category];

    causes.push({
      category,
      description:   `${categoryErrors.length} ${category} error(s) detected`,
      primaryError:  primary.message,
      relatedErrors: related,
      suggestedFix,
    });
  }

  return causes;
}

export function primaryRootCause(errors: ParsedError[]): RootCause | undefined {
  const causes = detectRootCauses(errors);
  return causes[0];
}
