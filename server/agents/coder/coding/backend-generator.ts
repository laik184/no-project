export const backendGenerator = {
  async generate(projectId: string): Promise<string> {
    return `// Generated backend for ${projectId}\n`;
  },
};

export async function generateBackend(projectId: string): Promise<string> {
  return backendGenerator.generate(projectId);
}
