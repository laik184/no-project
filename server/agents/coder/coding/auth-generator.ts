export const authGenerator = {
  async generate(projectId: string): Promise<string> {
    return `// Generated auth middleware for ${projectId}\n`;
  },
};

export async function generateAuthMiddleware(projectId: string): Promise<string> {
  return authGenerator.generate(projectId);
}
