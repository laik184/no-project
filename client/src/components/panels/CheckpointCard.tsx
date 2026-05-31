/**
 * CheckpointCard — chat-inline checkpoint wrapper.
 * Delegates rendering to CheckpointTimelineItem (the Replit-style component).
 * Kept as the public export so ChatMessages.tsx import paths stay unchanged.
 */
import { CheckpointTimelineItem } from "@/components/chat/checkpoints/CheckpointTimelineItem";

export type { CheckpointData } from "./checkpoint-types";

interface CheckpointCardProps {
  data:             import("./checkpoint-types").CheckpointData;
  checkpointNumber: number;
  isLatest:         boolean;
  allReverted?:     boolean;
}

function getProjectId(): number {
  return Number(window.localStorage.getItem("nura.projectId") || "1") || 1;
}

export function CheckpointCard({ data, checkpointNumber, isLatest }: CheckpointCardProps) {
  return (
    <>
      <style>{`
        @keyframes checkpoint-in {
          from { opacity: 0; transform: translateY(8px) scale(0.98); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
      <CheckpointTimelineItem
        data={data}
        checkpointNumber={checkpointNumber}
        isLatest={isLatest}
        projectId={getProjectId()}
      />
    </>
  );
}
