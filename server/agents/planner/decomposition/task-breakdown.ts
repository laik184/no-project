import type { PlanTask, PlanPhase, AppType, PlanComplexity, PhaseType, TaskCategory } from '../types/planner.types.ts';
import type { GoalAnalysis, Requirements } from '../types/planning.types.ts';
import { generateTaskId, priorityForPhase } from '../utils/planning-helpers.ts';

interface TaskSpec {
  title: string;
  description: string;
  category: TaskCategory;
  estimatedMinutes: number;
}

const SETUP_TASKS: TaskSpec[] = [
  { title: 'Initialize repository structure',      description: 'Create folders, tsconfig, and .env template',  category: 'setup', estimatedMinutes: 5 },
  { title: 'Install core dependencies',            description: 'Install framework and utility packages',        category: 'setup', estimatedMinutes: 5 },
  { title: 'Configure TypeScript',                 description: 'Set up tsconfig.json and path aliases',         category: 'setup', estimatedMinutes: 5 },
  { title: 'Set up database connection',           description: 'Configure Drizzle ORM and connection pool',     category: 'schema', estimatedMinutes: 10 },
];

const BACKEND_TASKS: TaskSpec[] = [
  { title: 'Define database schema',               description: 'Write Drizzle table definitions',               category: 'schema', estimatedMinutes: 15 },
  { title: 'Run database migrations',              description: 'Push schema to PostgreSQL',                     category: 'schema', estimatedMinutes: 5 },
  { title: 'Implement core API routes',            description: 'Build Express route handlers',                  category: 'api',    estimatedMinutes: 20 },
  { title: 'Add input validation',                 description: 'Add Zod schemas for all endpoints',             category: 'api',    estimatedMinutes: 10 },
  { title: 'Implement error handling middleware',  description: 'Global error handler and typed responses',      category: 'api',    estimatedMinutes: 10 },
];

const AUTH_TASKS: TaskSpec[] = [
  { title: 'Implement authentication endpoints',   description: 'Login, register, refresh token routes',         category: 'auth',   estimatedMinutes: 20 },
  { title: 'Add auth middleware',                  description: 'JWT verification and session management',       category: 'auth',   estimatedMinutes: 15 },
  { title: 'Protect API routes',                   description: 'Apply auth guard to sensitive endpoints',       category: 'auth',   estimatedMinutes: 10 },
];

const FRONTEND_TASKS: TaskSpec[] = [
  { title: 'Build layout and navigation',          description: 'Sidebar, header, and routing structure',        category: 'ui',     estimatedMinutes: 20 },
  { title: 'Implement core pages',                 description: 'Build primary application pages',              category: 'ui',     estimatedMinutes: 30 },
  { title: 'Connect API to UI',                    description: 'Wire TanStack Query hooks to API endpoints',   category: 'ui',     estimatedMinutes: 20 },
  { title: 'Add form handling',                    description: 'React Hook Form with Zod validation',           category: 'ui',     estimatedMinutes: 15 },
  { title: 'Add loading and error states',         description: 'Skeleton loaders and error boundaries',         category: 'ui',     estimatedMinutes: 10 },
];

const VERIFICATION_TASKS: TaskSpec[] = [
  { title: 'Verify application build',             description: 'Run build and fix any compile errors',          category: 'test',   estimatedMinutes: 10 },
  { title: 'Test core user flows',                 description: 'Manually verify critical happy paths',          category: 'test',   estimatedMinutes: 15 },
  { title: 'Check API endpoint responses',         description: 'Verify all routes return correct status codes', category: 'test',   estimatedMinutes: 10 },
];

const DEPLOYMENT_TASKS: TaskSpec[] = [
  { title: 'Configure environment variables',      description: 'Set all required secrets in deployment env',    category: 'deploy', estimatedMinutes: 10 },
  { title: 'Run production build',                 description: 'Build frontend and compile TypeScript',         category: 'deploy', estimatedMinutes: 10 },
  { title: 'Deploy to platform',                   description: 'Publish to hosting platform',                   category: 'deploy', estimatedMinutes: 10 },
];

export function buildTasksForPhases(
  phases: PlanPhase[],
  appType: AppType,
  complexity: PlanComplexity,
  analysis: GoalAnalysis,
  requirements: Requirements,
): PlanTask[] {
  const allTasks: PlanTask[] = [];

  for (const phase of phases) {
    const specs = selectSpecs(phase.type, analysis, requirements);
    const tasks = specs.map((spec) => createTask(spec, phase.type));
    phase.tasks = tasks;
    allTasks.push(...tasks);
  }

  return allTasks;
}

function selectSpecs(
  phaseType: PhaseType,
  analysis: GoalAnalysis,
  requirements: Requirements,
): TaskSpec[] {
  switch (phaseType) {
    case 'setup':        return SETUP_TASKS;
    case 'backend':      return analysis.hasAuth ? [...BACKEND_TASKS, ...AUTH_TASKS] : BACKEND_TASKS;
    case 'frontend':     return FRONTEND_TASKS;
    case 'verification': return VERIFICATION_TASKS;
    case 'deployment':   return DEPLOYMENT_TASKS;
    default:             return [];
  }
}

function createTask(spec: TaskSpec, phase: PhaseType): PlanTask {
  return {
    id:               generateTaskId(spec.category),
    phase,
    category:         spec.category,
    title:            spec.title,
    description:      spec.description,
    dependencies:     [],
    priority:         priorityForPhase(phase),
    estimatedMinutes: spec.estimatedMinutes,
  };
}
