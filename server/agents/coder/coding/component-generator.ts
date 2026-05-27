export const componentGenerator = {
  async generate(name: string): Promise<string> {
    return `// Generated component: ${name}\nexport function ${name}() { return null; }\n`;
  },
};

export async function generateComponent(name: string): Promise<string> {
  return componentGenerator.generate(name);
}
