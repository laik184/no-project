export function toPascalCase(str: string): string {
  return str
    .split(/[-_\s]+/)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join('');
}

export function toKebabCase(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .toLowerCase();
}

export function toCamelCase(str: string): string {
  const pascal = toPascalCase(str);
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}

export function fileHeader(filename: string, description: string): string {
  const date = new Date().toISOString().split('T')[0];
  return `// ${filename}\n// ${description}\n// Generated: ${date}\n\n`;
}

export function indent(code: string, spaces: number = 2): string {
  const pad = ' '.repeat(spaces);
  return code
    .split('\n')
    .map(line => (line.trim() ? pad + line : line))
    .join('\n');
}

export function stripMarkdownCodeBlock(text: string): string {
  return text
    .replace(/^```[\w]*\n?/, '')
    .replace(/\n?```$/, '')
    .trim();
}

export function pluralize(word: string): string {
  if (word.endsWith('y')) return word.slice(0, -1) + 'ies';
  if (word.endsWith('s')) return word + 'es';
  return word + 's';
}
