import { useState, useEffect, useRef } from "react";
import { DEPLOY_STEPS, DeployState, StepState } from "./types";

export function useDeployRunner() {
  const [deployState, setDeployState] = useState<DeployState>({
    active: false,
    panelOpen: false,
    stepStates: Array(DEPLOY_STEPS.length).fill("pending") as StepState[],
    stepLogs: DEPLOY_STEPS.map(() => []),
    currentStep: 0,
    done: false,
    failed: false,
    elapsedMs: 0,
  });

  const timerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clockRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTime = useRef<number>(0);

  const clearTimer = () => {
    if (timerRef.current)  { clearTimeout(timerRef.current);   timerRef.current  = null; }
    if (clockRef.current)  { clearInterval(clockRef.current);  clockRef.current  = null; }
  };

  const streamLogs = (stepIndex: number, logs: string[], onDone: () => void) => {
    let i = 0;
    const pushLog = () => {
      if (i >= logs.length) { onDone(); return; }
      const line = logs[i++];
      setDeployState((prev) => {
        const newStepLogs = prev.stepLogs.map((sl, si) =>
          si === stepIndex ? [...sl, line] : sl
        );
        return { ...prev, stepLogs: newStepLogs };
      });
      timerRef.current = setTimeout(pushLog, (DEPLOY_STEPS[stepIndex].duration / logs.length) * 0.85);
    };
    timerRef.current = setTimeout(pushLog, 120);
  };

  const runStep = (stepIndex: number, states: StepState[], stepLogs: string[][]) => {
    if (stepIndex >= DEPLOY_STEPS.length) {
      setDeployState((prev) => ({ ...prev, stepStates: states, done: true, failed: false }));
      clearTimer();
      return;
    }

    const nextStates = [...states];
    nextStates[stepIndex] = "running";
    setDeployState((prev) => ({ ...prev, stepStates: nextStates, currentStep: stepIndex }));

    streamLogs(stepIndex, DEPLOY_STEPS[stepIndex].logs, () => {
      timerRef.current = setTimeout(() => {
        const successStates = [...nextStates];
        successStates[stepIndex] = "success";
        const newLogs = stepLogs.map((sl, si) =>
          si === stepIndex ? DEPLOY_STEPS[stepIndex].logs : sl
        );
        if (stepIndex === DEPLOY_STEPS.length - 1) {
          setDeployState((prev) => ({ ...prev, stepStates: successStates, stepLogs: newLogs, done: true, failed: false }));
          clearTimer();
        } else {
          setDeployState((prev) => ({ ...prev, stepStates: successStates, stepLogs: newLogs }));
          runStep(stepIndex + 1, successStates, newLogs);
        }
      }, DEPLOY_STEPS[stepIndex].duration * 0.15);
    });
  };

  const startDeploy = () => {
    clearTimer();
    startTime.current = Date.now();
    const fresh: StepState[] = Array(DEPLOY_STEPS.length).fill("pending");
    const freshLogs = DEPLOY_STEPS.map(() => [] as string[]);
    setDeployState({ active: true, panelOpen: true, stepStates: fresh, stepLogs: freshLogs, currentStep: 0, done: false, failed: false, elapsedMs: 0 });
    clockRef.current = setInterval(() => {
      setDeployState((prev) => ({ ...prev, elapsedMs: Date.now() - startTime.current }));
    }, 100);
    runStep(0, fresh, freshLogs);
  };

  const retryDeploy = () => startDeploy();

  const closePanel = () => {
    setDeployState((prev) => ({ ...prev, panelOpen: false }));
  };

  useEffect(() => () => clearTimer(), []);

  return { deployState, startDeploy, retryDeploy, closePanel };
}
