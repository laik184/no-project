import type { FrontendPlan, BackendPlan, DatabasePlan, ApiPlan, DeploymentPlan } from '../types/planning.types.ts';

export interface AiAppTemplateDefaults {
  frontendPlan:   FrontendPlan;
  backendPlan:    BackendPlan;
  databasePlan:   DatabasePlan;
  apiPlan:        ApiPlan;
  deploymentPlan: DeploymentPlan;
}

export function getAiAppTemplateDefaults(): AiAppTemplateDefaults {
  return {
    frontendPlan: {
      framework:       'React',
      routing:         'Wouter',
      stateManagement: 'TanStack Query',
      uiLibrary:       'shadcn/ui + Tailwind CSS',
      pages:           ['Home', 'Chat', 'History', 'Settings'],
      features:        ['chat-interface', 'markdown-renderer', 'streaming', 'history-sidebar', 'model-selector', 'token-counter'],
    },
    backendPlan: {
      framework:  'Express',
      language:   'TypeScript',
      services:   ['LLMService', 'EmbeddingService', 'ChatService', 'HistoryService', 'StreamService'],
      middleware: ['cors', 'json-body-parser', 'auth-middleware', 'rate-limiter', 'error-handler', 'request-logger'],
      modules:    ['llm', 'embedding', 'chat', 'history', 'health'],
    },
    databasePlan: {
      type:      'postgresql',
      orm:       'Drizzle ORM',
      entities:  ['User', 'Conversation', 'Message', 'Embedding', 'ApiUsage'],
      relations: ['User → Conversation (1:N)', 'Conversation → Message (1:N)', 'Message → Embedding (1:1)'],
      indexing:  ['conversation.user_id', 'message.conversation_id', 'message.created_at', 'api_usage.user_id'],
    },
    apiPlan: {
      style:     'rest',
      endpoints: [
        { method: 'POST',   path: '/api/chat',                description: 'Send message and stream response' },
        { method: 'GET',    path: '/api/conversations',       description: 'List user conversations' },
        { method: 'GET',    path: '/api/conversations/:id',   description: 'Get conversation with messages' },
        { method: 'DELETE', path: '/api/conversations/:id',   description: 'Delete conversation' },
        { method: 'GET',    path: '/api/models',              description: 'List available LLM models' },
        { method: 'GET',    path: '/api/usage',               description: 'Get token usage stats' },
        { method: 'GET',    path: '/health',                   description: 'Health check' },
      ],
      authStrategy: 'jwt-bearer',
      rateLimiting: true,
      versioning:   false,
    },
    deploymentPlan: {
      platform:     'Replit Autoscale',
      buildCommand: 'npm run build',
      startCommand: 'node dist/server.js',
      envVars:      ['DATABASE_URL', 'NODE_ENV', 'PORT', 'OPENROUTER_API_KEY', 'JWT_SECRET'],
      scaling:      'horizontal with sticky sessions',
    },
  };
}
