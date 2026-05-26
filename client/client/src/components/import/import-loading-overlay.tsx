import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { CheckCircle2, Loader2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ImportJob } from "@/types/import";

interface ImportLoadingOverlayProps {
  serviceName: string;
  serviceColor: string;
  serviceIcon: React.ReactNode;
  steps: string[];
  importId?: string;
  onDone?: (projectId: number) => void;
}

export function ImportLoadingOverlay({
  serviceName,
  serviceColor,
  serviceIcon,
  steps,
  importId,
  onDone,
}: ImportLoadingOverlayProps) {
  const [, setLocation] = useLocation();
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const [progress, setProgress] = useState(0);
  const [stepLabels, setStepLabels] = useState<string[]>(steps);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!importId) return;
    const es = new EventSource(`/api/import/status/${importId}`);
    es.onmessage = (e) => {
      try {
        const job: ImportJob = JSON.parse(e.data);
        setStepLabels(job.steps.map((s) => s.label));
        setProgress(job.percent);
        const done = job.steps.map((s, i) => (s.done ? i : -1)).filter((i) => i >= 0);
        setCompletedSteps(done);
        const activeIdx = job.steps.findIndex((s) => s.active);
        if (activeIdx >= 0) setCurrentStep(activeIdx);
        if (job.status === "done") {
          es.close();
          setTimeout(() => {
            if (onDone && job.projectId != null) onDone(job.projectId);
            else setLocation(job.projectId ? `/workspace/${job.projectId}` : "/workspace");
          }, 600);
        }
        if (job.status === "error") {
          es.close();
          setError(job.error ?? "Import failed");
        }
      } catch {}
    };
    es.onerror = () => { setError("Connection lost. Please try again."); es.close(); };
    return () => es.close();
  }, [importId]);

  useEffect(() => {
    if (importId) return;
    const stepDuration = 6000 / steps.length;
    const startTime = Date.now();
    const progressInterval = setInterval(() => {
      const pct = Math.min(((Date.now() - startTime) / 6000) * 100, 100);
      setProgress(pct);
      if (pct >= 100) clearInterval(progressInterval);
    }, 30);
    const stepTimers: ReturnType<typeof setTimeout>[] = [];
    steps.forEach((_, i) => {
      if (i === 0) return;
      stepTimers.push(setTimeout(() => {
        setCompletedSteps((prev) => [...prev, i - 1]);
        setCurrentStep(i);
      }, stepDuration * i));
    });
    const finalTimer = setTimeout(() => {
      setCompletedSteps((prev) => [...prev, steps.length - 1]);
      setTimeout(() => setLocation("/workspace"), 400);
    }, 6000);
    return () => {
      clearInterval(progressInterval);
      stepTimers.forEach(clearTimeout);
      clearTimeout(finalTimer);
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center" style={{ background: "hsl(222,30%,7%)" }}>
      <div className="absolute inset-0 pointer-events-none" style={{ background: `radial-gradient(ellipse 60% 40% at 50% 50%, ${serviceColor}18 0%, transparent 70%)` }} />
      <div className="relative flex flex-col items-center w-full max-w-sm px-6">
        <div className="relative mb-8">
          <div className="w-20 h-20 rounded-2xl flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${serviceColor}33, ${serviceColor}18)`, border: `1px solid ${serviceColor}40`, boxShadow: `0 0 40px ${serviceColor}30` }}>
            {serviceIcon}
          </div>
          {!error && <div className="absolute inset-0 rounded-2xl animate-ping opacity-20" style={{ border: `2px solid ${serviceColor}` }} />}
        </div>

        {error ? (
          <div className="flex flex-col items-center text-center">
            <AlertCircle className="w-8 h-8 text-red-400 mb-3" />
            <h2 className="text-lg font-semibold text-white mb-2">Import Failed</h2>
            <p className="text-sm text-red-400 mb-6 leading-relaxed">{error}</p>
            <button onClick={() => history.back()} className="px-5 py-2.5 rounded-xl text-sm font-medium text-white hover:bg-white/10 transition-colors" style={{ border: "1px solid rgba(255,255,255,0.15)" }}>
              Go Back
            </button>
          </div>
        ) : (
          <>
            <h2 className="text-xl font-semibold text-white mb-1">Importing from {serviceName}</h2>
            <p className="text-sm text-muted-foreground mb-8 text-center">Setting up your workspace, please wait…</p>
            <div className="w-full h-1 rounded-full mb-8 overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
              <div className="h-full rounded-full transition-all duration-150" style={{ width: `${progress}%`, background: `linear-gradient(90deg, ${serviceColor}, #a78bfa)`, boxShadow: `0 0 8px ${serviceColor}80` }} />
            </div>
            <div className="w-full space-y-3">
              {stepLabels.map((step, i) => {
                const isCompleted = completedSteps.includes(i);
                const isActive = currentStep === i && !isCompleted;
                return (
                  <div key={i} className={cn("flex items-center gap-3 transition-all duration-300", isCompleted || isActive ? "opacity-100" : "opacity-30")}>
                    <div className="flex-shrink-0 w-5 h-5 flex items-center justify-center">
                      {isCompleted ? <CheckCircle2 className="w-4 h-4 text-green-400" /> : isActive ? <Loader2 className="w-4 h-4 animate-spin" style={{ color: serviceColor }} /> : <div className="w-1.5 h-1.5 rounded-full bg-white/20" />}
                    </div>
                    <span className={cn("text-sm transition-colors duration-300", isCompleted ? "text-green-400" : isActive ? "text-white" : "text-muted-foreground")}>{step}</span>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
