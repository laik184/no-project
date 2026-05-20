export function deepFreeze<T>(obj: T): Readonly<T> {
  if (obj === null || typeof obj !== 'object') return obj as Readonly<T>;
  Object.getOwnPropertyNames(obj).forEach((name) => {
    const value = (obj as Record<string, unknown>)[name];
    if (value !== null && typeof value === 'object') {
      deepFreeze(value as object);
    }
  });
  return Object.freeze(obj);
}
