export const databaseGenerator = {
  async generate(tables: string[]): Promise<string> {
    return `// Generated schema\n// Tables: ${tables.join(', ')}\n`;
  },
};

export async function generateSchema(tables: string[]): Promise<string> {
  return databaseGenerator.generate(tables);
}
