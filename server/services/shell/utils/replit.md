# Shell Utilities

## Purpose
Provide non-domain helper functions for process spawn, stream parsing, command token parsing, logging, and error normalization.

## Files
- `spawn.util.ts`: low-level child process spawn wrapper.
- `stream-parser.util.ts`: chunk-to-line stream parsing helpers.
- `command-parser.util.ts`: token sanitation and injection checks.
- `logger.util.ts`: timestamped log line formatter.
- `error-normalizer.util.ts`: normalize unknown errors to strings.

## Import Diagram
`agents/* -> utils/*`
`orchestrator.ts -> utils/logger.util.ts + utils/error-normalizer.util.ts`
