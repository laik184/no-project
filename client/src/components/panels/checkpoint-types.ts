export interface CheckpointData {
  checkpointId: string;
  label: string;
  description: string;
  time: string;
  filesChanged: number;
}

export const ACTION_STEPS = [
  { icon: "📦", label: "Installed required packages" },
  { icon: "✏️", label: "Edited and created files" },
  { icon: "🖥️", label: "Started the dev server" },
  { icon: "🐛", label: "Debugged for errors — none found" },
  { icon: "✅", label: "All tests passed" },
  { icon: "👁️", label: "Verified the preview" },
  { icon: "🚀", label: "Deployed to production" },
];
