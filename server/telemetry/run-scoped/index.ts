/**
 * server/telemetry/run-scoped/index.ts — Public API for run-scoped telemetry.
 */

export {
  getOrCreateChannel,
  emitToRun,
  attachSSE,
  getBuffer,
  destroyChannel,
  allChannelStats,
  activeChannelCount,
} from "./run-scoped-telemetry.ts";

export { RunTelemetryChannel } from "./run-telemetry-channel.ts";
export type { TelemetryEvent, ChannelStats } from "./run-telemetry-channel.ts";
