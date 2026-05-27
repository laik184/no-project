export const apiGenerator = {
  async generate(projectId: string, routes: string[]): Promise<string> {
    return `// Generated API routes for ${projectId}\n// Routes: ${routes.join(', ')}\n`;
  },
};

export async function generateApiRoutes(projectId: string, routes: string[]): Promise<string> {
  return apiGenerator.generate(projectId, routes);
}
