/**
 * IQ 2000 — Console · InstallProgress
 *
 * Animated progress bar shown during npm install.
 * Appears when state = 'installing', disappears on completion.
 * Shows package count and vulnerability count when available.
 */

import React, { useEffect, useState } from "react";
import type { NpmMeta } from "@/types/console";

interface Props {
  active:     boolean;
  lastNpmMeta?: NpmMeta;
}

export function InstallProgress({ active, lastNpmMeta }: Props) {
  const [progress, setProgress] = useState(0);
  const [visible, setVisible]   = useState(false);

  // Animate progress bar forward while installing
  useEffect(() => {
    if (!active) {
      if (visible) {
        setProgress(100);
        const t = setTimeout(() => { setVisible(false); setProgress(0); }, 700);
        return () => clearTimeout(t);
      }
      return;
    }

    setVisible(true);

    // Simulate progress that slows near 90% (never completes unless active=false)
    const tick = setInterval(() => {
      setProgress((p) => {
        if (p >= 88) return p + 0.2;
        if (p >= 70) return p + 0.8;
        return p + 2.5;
      });
    }, 200);

    return () => clearInterval(tick);
  }, [active]);

  if (!visible) return null;

  const isDone   = lastNpmMeta?.type === 'install-done';
  const pkgs     = lastNpmMeta?.packages;
  const vulns    = lastNpmMeta?.vulnerabilities;

  return (
    <div
      className="px-4 py-2 flex-shrink-0"
      style={{ borderBottom: "1px solid rgba(255,217,61,0.08)" }}
    >
      {/* Label row */}
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[10px]" style={{ color: "#ffd93d" }}>
          {isDone ? "Packages installed" : "Installing packages…"}
        </span>
        <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.35)" }}>
          {isDone && pkgs ? `${pkgs} packages` : ""}
          {isDone && vulns ? ` · ${vulns} vuln` : ""}
        </span>
      </div>

      {/* Progress track */}
      <div
        className="w-full rounded-full overflow-hidden"
        style={{ height: 3, background: "rgba(255,217,61,0.12)" }}
      >
        <div
          className="h-full rounded-full transition-all"
          style={{
            width:      `${Math.min(progress, 100)}%`,
            background: isDone ? "#6bcb77" : "linear-gradient(90deg, #ffd93d, #ff9f1c)",
            transition: isDone ? "width 0.4s ease, background 0.3s ease" : "width 0.2s linear",
          }}
        />
      </div>
    </div>
  );
}
