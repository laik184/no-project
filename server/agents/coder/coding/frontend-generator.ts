export const frontendGenerator = {
  async generate(projectId: string): Promise<string> {
    return `// Generated frontend for ${projectId}\n`;
  },
};

export async function generateFrontend(projectId: string): Promise<string> {
  return frontendGenerator.generate(projectId);
}
