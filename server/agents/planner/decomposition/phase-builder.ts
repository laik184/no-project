import type { PlanPhase, PhaseType, AppType, PlanComplexity } from '../types/planner.types.ts';
import type { GoalAnalysis } from '../types/planning.types.ts';
import { generatePhaseId } from '../utils/planning-helpers.ts';
import { emitPlanningPhaseGenerated } from '../events/planner-events.ts';

interface PhaseSpec {
  type: PhaseType;
  title: string;
  description: string;
}

const PHASE_SPECS: Record<PhaseType, PhaseSpec> = {
  setup:        { type: 'setup',        title: 'Project Setup',       description: 'Initialize project structure, dependencies, and configuration' },
  backend:      { type: 'backend',      title: 'Backend Development',  description: 'Implement API routes, services, and business logic' },
  frontend:     { type: 'frontend',     title: 'Frontend Development', description: 'Build UI components, pages, and client-side logic' },
  verification: { type: 'verification', title: 'Testing & Verification', description: 'Run tests, verify build, and validate functionality' },
  deployment:   { type: 'deployment',   title: 'Deployment',           description: 'Configure deployment, environment variables, and launch' },
};

export function buildPhases(
  runId: string,
  appType: AppType,
  complexity: PlanComplexity,
  analysis: GoalAnalysis,
): PlanPhase[] {
  const phaseTypes = selectPhaseTypes(analysis);
  const phases: PlanPhase[] = [];

  phaseTypes.forEach((type, index) => {
    const spec = PHASE_SPECS[type];
    const phase: PlanPhase = {
      id:          generatePhaseId(type),
      type,
      title:       spec.title,
      description: spec.description,
      tasks:       [],
      order:       index + 1,
    };
    phases.push(phase);
    emitPlanningPhaseGenerated(runId, type, 0);
  });

  return phases;
}

function selectPhaseTypes(analysis: GoalAnalysis): PhaseType[] {
  const types: PhaseType[] = ['setup'];

  if (analysis.hasBackend)  types.push('backend');
  if (analysis.hasFrontend) types.push('frontend');

  types.push('verification');

  if (analysis.deploymentNeeds !== 'none') types.push('deployment');

  return types;
}
