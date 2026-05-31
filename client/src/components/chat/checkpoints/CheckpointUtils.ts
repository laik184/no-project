/**
 * CheckpointUtils.ts — Pure helpers for checkpoint UI components.
 */

/** Format a timestamp as a relative string like "just now", "3 minutes ago". */
export function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const secs  = Math.floor(diffMs / 1000);
  const mins  = Math.floor(secs / 60);
  const hours = Math.floor(mins / 60);

  if (secs < 10)  return 'just now';
  if (secs < 60)  return `${secs} seconds ago`;
  if (mins === 1) return '1 minute ago';
  if (mins < 60)  return `${mins} minutes ago`;
  if (hours === 1)return '1 hour ago';
  if (hours < 24) return `${hours} hours ago`;
  return new Date(iso).toLocaleDateString();
}

/** Format a Date object the same way. */
export function formatRelativeDate(date: Date): string {
  return formatRelativeTime(date.toISOString());
}

/** Derive a human-readable trigger label. */
export function triggerLabel(trigger: string): string {
  const map: Record<string, string> = {
    run_complete:    'end of loop',
    files_threshold: 'files threshold',
    phase_complete:  'phase complete',
    loop_end:        'end of loop',
    manual:          'manual',
  };
  return map[trigger] ?? trigger.replace(/_/g, ' ');
}

/** Total files across all change categories. */
export function totalFiles(
  created: string[],
  modified: string[],
  deleted: string[],
): number {
  return created.length + modified.length + deleted.length;
}

/** Shorten a file path for display, keeping only last 2 segments. */
export function shortPath(p: string): string {
  const parts = p.replace(/\\/g, '/').split('/');
  return parts.length > 2 ? `…/${parts.slice(-2).join('/')}` : p;
}
