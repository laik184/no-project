import type { PlanPhase } from '../types/planner.types.ts';
import type { Milestone } from '../types/planning.types.ts';
import { randomUUID } from 'crypto';

const MILESTONE_TITLES: Record<string, string> = {
  setup:        'Project Foundation Ready',
  backend:      'Backend API Operational',
  frontend:     'UI Fully Rendered',
  verification: 'All Tests Passing',
  deployment:   'Application Live',
};

const MILESTONE_ESTIMATED_MINUTES: Record<string, number> = {
  setup:        20,
  backend:      60,
  frontend:     75,
  verification: 35,
  deployment:   30,
};

export function generateMilestones(phases: PlanPhase[]): Milestone[] {
  const milestones: Milestone[] = [];
  let previousMilestoneId: string | null = null;

  for (const phase of phases) {
    const milestoneId = `milestone_${phase.type}_${randomUUID().slice(0, 6)}`;

    const milestone: Milestone = {
      id:               milestoneId,
      title:            MILESTONE_TITLES[phase.type] ?? `${phase.title} Complete`,
      phase:            phase.type,
      dependsOn:        previousMilestoneId ? [previousMilestoneId] : [],
      estimatedMinutes: MILESTONE_ESTIMATED_MINUTES[phase.type] ?? 30,
    };

    milestones.push(milestone);
    previousMilestoneId = milestoneId;
  }

  return milestones;
}
