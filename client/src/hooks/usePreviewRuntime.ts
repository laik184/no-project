import { useState, useEffect } from "react";
import { PreviewRuntimeService } from "@/services/preview-runtime.service";

export const usePreviewRuntime = (projectId: string, projectPath: string) => {
  const [isRunning, setIsRunning] = useState(false);
  const [tunnelUrl, setTunnelUrl] = useState<string | null>(null);
  const [lastReloadType, setLastReloadType] = useState<"hot"|"hard"|null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const status = await PreviewRuntimeService.getStatus();
        setIsRunning(status.running?.length > 0);

        const tunnel = await PreviewRuntimeService.getTunnelInfo();
        if (tunnel?.url) setTunnelUrl(tunnel.url);
      } catch {}
    };
    load();
  }, []);

  const run = async () => {
    await PreviewRuntimeService.runProject(projectId, projectPath);
    setIsRunning(true);
    setLastReloadType("hot");
  };

  const stop = async () => {
    await PreviewRuntimeService.stopProject(projectId);
    setIsRunning(false);
    setLastReloadType("hard");
  };

  const restart = async () => {
    await PreviewRuntimeService.restartProject(projectId, projectPath);
    setIsRunning(true);
    setLastReloadType("hard");
  };

  return { isRunning, run, stop, restart, tunnelUrl, lastReloadType };
};