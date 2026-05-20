export const appConfig = {
  environment: process.env['NODE_ENV'] ?? 'development',
  port: Number(process.env['PORT'] ?? 3001),
  debug: process.env['NODE_ENV'] !== 'production' && process.env['DEBUG'] === 'true',
} as const;

export default appConfig;
