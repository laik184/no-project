/**
 * checkpoint.constants.ts
 * Tunable constants for the checkpoint / rollback system.
 */

/** Max checkpoints kept per project in the metadata store */
export const MAX_CHECKPOINTS_PER_PROJECT = 20;

/** Max age of a checkpoint before it is eligible for eviction (7 days) */
export const CHECKPOINT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

/** Base directory for file-system checkpoint snapshots */
export const CHECKPOINT_FS_BASE = ".data/checkpoints/v2";

/** Git commit author used for autonomous checkpoint commits */
export const GIT_AUTHOR_NAME  = "NURA-X Checkpoint";
export const GIT_AUTHOR_EMAIL = "checkpoint@nura-x.dev";

/** Commit message prefix for checkpoint commits */
export const GIT_COMMIT_PREFIX = "chore(checkpoint):";

/** Files/dirs excluded from snapshot capture */
export const SNAPSHOT_EXCLUDE = new Set([
  "node_modules",
  ".git",
  "dist",
  ".cache",
  ".data",
  "__pycache__",
  ".venv",
]);

/** Max total snapshot size (bytes) before we skip file snapshot, git-only */
export const SNAPSHOT_MAX_BYTES = 10 * 1024 * 1024; // 10 MB

/** Temp file suffix used during atomic writes */
export const ATOMIC_WRITE_SUFFIX = ".nura_tmp";
