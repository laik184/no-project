import { randomUUID } from 'crypto';

export function generateExecutionId(): string {
  return `exec_${Date.now()}_${randomUUID().replace(/-/g, '').slice(0, 10)}`;
}

export function generateStepId(type: string): string {
  return `step_${type}_${Date.now()}_${randomUUID().slice(0, 8)}`;
}

export function generateCheckpointId(): string {
  return `ckpt_${Date.now()}_${randomUUID().slice(0, 8)}`;
}

export function generateSessionId(): string {
  return `esess_${randomUUID().replace(/-/g, '').slice(0, 12)}`;
}

export function formatStepLabel(type: string, name?: string): string {
  const base = type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  return name ? `${base}: ${name}` : base;
}

export function elapsedMs(since: Date): number {
  return Date.now() - since.getTime();
}

export function stepTimeout(type: string): number {
  const timeouts: Record<string, number> = {
    generate_frontend:  15_000,
    generate_backend:   15_000,
    generate_api:       10_000,
    generate_database:  10_000,
    generate_auth:      10_000,
    generate_component: 10_000,
    write_file:          5_000,
    read_file:           5_000,
    edit_file:           5_000,
    patch_file:          5_000,
    delete_file:         3_000,
    list_directory:      5_000,
    search_files:       10_000,
    npm_install:        90_000,
    npm_run:            60_000,
    run_command:        30_000,
    run_tests:          60_000,
    validate_output:    10_000,
    checkpoint:          5_000,
  };
  return timeouts[type] ?? 15_000;
}

export function categoryToStepType(category: string): string {
  const map: Record<string, string> = {
    setup:   'run_command',
    schema:  'generate_database',
    api:     'generate_api',
    auth:    'generate_auth',
    ui:      'generate_frontend',
    test:    'run_tests',
    deploy:  'npm_run',
  };
  return map[category] ?? 'write_file';
}
