let counter = 0;

export function createId(prefix: string): string {
  counter += 1;
  return `${prefix}-${counter.toString(36).padStart(4, '0')}`;
}
