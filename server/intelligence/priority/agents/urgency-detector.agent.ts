import { TaskInput, UrgencyScore } from "../types";
import { clamp, scaleToHundred } from "../utils/normalize.util";

const OVERDUE_SCORE = 100;
const CRITICAL_HOURS = 4;
const HIGH_HOURS = 24;
const MEDIUM_HOURS = 72;
const LOW_HOURS = 168;

export function detectUrgency(task: TaskInput, now: number): UrgencyScore {
  if (!task.deadline) {
    const hasSystemCritical = task.systemCritical === true;
    return Object.freeze({
      taskId: task.id,
      score: hasSystemCritical ? 60 : 20,
      isOverdue: false,
      reason: hasSystemCritical
        ? "No deadline but system-critical flag set."
        : "No deadline — baseline urgency applied.",
    });
  }

  const msUntil = task.deadline - now;
  const hoursUntil = msUntil / (1000 * 60 * 60);

  if (hoursUntil <= 0) {
    return Object.freeze({
      taskId: task.id,
      score: OVERDUE_SCORE,
      isOverdue: true,
      hoursUntilDeadline: hoursUntil,
      reason: `Overdue by ${Math.abs(Math.round(hoursUntil))}h — maximum urgency.`,
    });
  }

  let score: number;
  let reason: string;

  if (hoursUntil <= CRITICAL_HOURS) {
    score = clamp(95 - hoursUntil * 2);
    reason = `Deadline in ${hoursUntil.toFixed(1)}h — critically urgent.`;
  } else if (hoursUntil <= HIGH_HOURS) {
    score = clamp(scaleToHundred(HIGH_HOURS - hoursUntil, HIGH_HOURS) * 0.4 + 55);
    reason = `Deadline in ${hoursUntil.toFixed(1)}h — high urgency.`;
  } else if (hoursUntil <= MEDIUM_HOURS) {
    score = clamp(scaleToHundred(MEDIUM_HOURS - hoursUntil, MEDIUM_HOURS) * 0.3 + 35);
    reason = `Deadline in ${Math.round(hoursUntil)}h — medium urgency.`;
  } else if (hoursUntil <= LOW_HOURS) {
    score = clamp(scaleToHundred(LOW_HOURS - hoursUntil, LOW_HOURS) * 0.2 + 15);
    reason = `Deadline in ${Math.round(hoursUntil / 24)}d — low urgency.`;
  } else {
    score = 10;
    reason = `Deadline in ${Math.round(hoursUntil / 24)}d — minimal urgency.`;
  }

  return Object.freeze({
    taskId: task.id,
    score: Math.round(score),
    isOverdue: false,
    hoursUntilDeadline: hoursUntil,
    reason,
  });
}

export function detectAllUrgency(tasks: readonly TaskInput[], now: number): readonly UrgencyScore[] {
  return Object.freeze(tasks.map((t) => detectUrgency(t, now)));
}
