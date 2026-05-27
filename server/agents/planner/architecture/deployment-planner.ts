import type { AppType, PlanComplexity } from '../types/planner.types.ts';
import type { DeploymentPlan, GoalAnalysis } from '../types/planning.types.ts';

export function planDeployment(
  appType: AppType,
  complexity: PlanComplexity,
  analysis: GoalAnalysis,
): DeploymentPlan {
  const { platform, scaling } = selectPlatformAndScaling(appType, complexity, analysis);
  const envVars = buildRequiredEnvVars(analysis);

  const hasFrontend = analysis.hasFrontend;
  const buildCommand = hasFrontend ? 'npm run build' : 'tsc -p tsconfig.json';
  const startCommand = hasFrontend
    ? 'node dist/server.js'
    : 'node dist/index.js';

  return {
    platform,
    buildCommand,
    startCommand,
    envVars,
    scaling,
  };
}

function selectPlatformAndScaling(
  appType: AppType,
  complexity: PlanComplexity,
  analysis: GoalAnalysis,
): { platform: string; scaling: string } {
  if (analysis.hasRealtime || appType === 'ai_app') {
    return {
      platform: 'Replit Autoscale',
      scaling:  'horizontal with sticky sessions',
    };
  }
  if (complexity === 'high' || appType === 'saas') {
    return {
      platform: 'Replit Autoscale',
      scaling:  'horizontal auto-scaling',
    };
  }
  return {
    platform: 'Replit Reserved VM',
    scaling:  'single instance',
  };
}

function buildRequiredEnvVars(analysis: GoalAnalysis): string[] {
  const vars = ['DATABASE_URL', 'NODE_ENV', 'PORT'];
  if (analysis.hasAuth)     vars.push('SESSION_SECRET', 'JWT_SECRET');
  if (analysis.hasAI)       vars.push('OPENROUTER_API_KEY');
  if (analysis.hasPayments) vars.push('STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET');
  if (analysis.hasNotifications) vars.push('SENDGRID_API_KEY');
  if (analysis.hasFileUpload)    vars.push('STORAGE_BUCKET', 'STORAGE_KEY');
  return vars;
}
