import { useState, useRef, useEffect, useCallback, type RefObject, type FormEvent } from "react";
import { useRealtimeEvent } from "@/realtime/useRealtimeStream";

interface UseNavigationLogicArgs {
  iframeRef: RefObject<HTMLIFrameElement>;
  executionState: { status: string };
  autoReloadEnabled: boolean;
  isRunning: boolean;
  setIsRunning: (v: boolean) => void;
  setIframeKey: React.Dispatch<React.SetStateAction<number>>;
  setLastReloadType: React.Dispatch<React.SetStateAction<"hot" | "hard" | null>>;
  setCrashReason: React.Dispatch<React.SetStateAction<string | null>>;
}

export function useNavigationLogic({
  iframeRef,
  executionState,
  autoReloadEnabled,
  isRunning,
  setIsRunning,
  setIframeKey,
  setLastReloadType,
  setCrashReason,
}: UseNavigationLogicArgs) {
  const [currentUrl, setCurrentUrl] = useState("localhost:5000");
  const [publicUrl, setPublicUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [urlInput, setUrlInput] = useState("http://localhost:5000");
  const [showDevUrlPopup, setShowDevUrlPopup] = useState(false);
  const [privateDevUrl, setPrivateDevUrl] = useState(false);
  const [copiedDevLink, setCopiedDevLink] = useState(false);
  const devUrlPopupRef = useRef<HTMLDivElement>(null);
  const navigationHistoryRef = useRef<string[]>(["localhost:5000"]);
  const navigationIndexRef = useRef(0);

  useEffect(() => {
    const replitDevDomain = import.meta.env.VITE_REPLIT_DEV_DOMAIN;
    const domain = replitDevDomain || window.location.host || "localhost:5000";
    setPublicUrl(domain);
  }, []);

  useEffect(() => {
    const fetchTunnelInfo = async () => {
      try {
        const res = await fetch("/api/tunnel-info");
        if (!res.ok) return;
        const data = await res.json();
        if (data?.ok && data.url) {
          try {
            const urlObj = new URL(data.url);
            const hostPortPath = `${urlObj.hostname}${urlObj.port ? ":" + urlObj.port : ""}${urlObj.pathname}`;
            setPublicUrl(hostPortPath);
          } catch {
            setPublicUrl(data.url);
          }
        }
      } catch (e) {
        console.error("Failed to load tunnel info", e);
      }
    };
    fetchTunnelInfo();
  }, []);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await fetch("/api/project-status");
        const data = await res.json();
        if (data?.ok && Array.isArray(data.running)) {
          setIsExecuting(data.running.length > 0);
        }
      } catch (e) {
        console.error("Status sync failed", e);
      }
    };
    fetchStatus();
  }, []);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/preview-sw.js").catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (!autoReloadEnabled) return;
    if (executionState.status === "completed" || executionState.status === "error") {
      setCrashReason("Last crash at " + new Date().toLocaleTimeString());
      if (iframeRef.current) {
        iframeRef.current.src = iframeRef.current.src;
        setLastReloadType("hot");
      }
    }
  }, [executionState.status, autoReloadEnabled]);

  useEffect(() => {
    const handler = () => { setIframeKey((k) => k + 1); };
    window.addEventListener("file-refresh", handler);
    return () => window.removeEventListener("file-refresh", handler);
  }, []);

  // Preview auto-refresh: when the AI verifies the runtime is healthy, do a
  // soft reload so the user immediately sees the latest app state without
  // manually clicking refresh.
  useRealtimeEvent("runtime.verified", () => {
    setIframeKey((k) => k + 1);
    setLastReloadType("hot");
  });

  useEffect(() => {
    if (!showDevUrlPopup) return;
    const handler = (e: MouseEvent) => {
      if (devUrlPopupRef.current && !devUrlPopupRef.current.contains(e.target as Node)) {
        setShowDevUrlPopup(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showDevUrlPopup]);

  useEffect(() => {
    const displayUrl = `http://${currentUrl || publicUrl || "localhost:5000"}`;
    setUrlInput(displayUrl);
  }, [currentUrl, publicUrl]);

  const handleIframeLoad = useCallback(() => {
    try {
      if (iframeRef.current?.contentWindow?.location) {
        const href = iframeRef.current.contentWindow.location.href;
        const url = new URL(href);
        const newUrl = `${url.hostname}${url.port ? ':' + url.port : ''}${url.pathname}`;
        setCurrentUrl(newUrl);
        const currentIndex = navigationIndexRef.current;
        navigationHistoryRef.current = navigationHistoryRef.current.slice(0, currentIndex + 1);
        if (navigationHistoryRef.current[navigationHistoryRef.current.length - 1] !== newUrl) {
          navigationHistoryRef.current.push(newUrl);
          navigationIndexRef.current = navigationHistoryRef.current.length - 1;
        }
      }
    } catch {
      setCurrentUrl(publicUrl);
    }
    setIsExecuting(false);
  }, [publicUrl]);

  const handleUrlInputSubmit = (e: FormEvent) => {
    e.preventDefault();
    let value = urlInput.trim();
    if (!value) return;
    if (!/^https?:\/\//i.test(value)) value = `http://${value}`;
    try {
      const urlObj = new URL(value);
      const newUrl = `${urlObj.hostname}${urlObj.port ? ':' + urlObj.port : ''}${urlObj.pathname}`;
      if (iframeRef.current) iframeRef.current.src = value;
      setCurrentUrl(newUrl);
      const currentIndex = navigationIndexRef.current;
      navigationHistoryRef.current = navigationHistoryRef.current.slice(0, currentIndex + 1);
      if (navigationHistoryRef.current[navigationHistoryRef.current.length - 1] !== newUrl) {
        navigationHistoryRef.current.push(newUrl);
        navigationIndexRef.current = navigationHistoryRef.current.length - 1;
      }
      setIsExecuting(true);
    } catch (err) {
      console.error("Invalid URL entered in preview bar", err);
    }
  };

  const handleNavigateBack = useCallback(() => {
    if (navigationIndexRef.current > 0) {
      navigationIndexRef.current--;
      const url = navigationHistoryRef.current[navigationIndexRef.current];
      if (iframeRef.current && url) iframeRef.current.src = `http://${url}`;
    }
  }, []);

  const handleNavigateForward = useCallback(() => {
    if (navigationIndexRef.current < navigationHistoryRef.current.length - 1) {
      navigationIndexRef.current++;
      const url = navigationHistoryRef.current[navigationIndexRef.current];
      if (iframeRef.current && url) iframeRef.current.src = `http://${url}`;
    }
  }, []);

  const handleHardRestart = async () => {
    try {
      setIsExecuting(true);
      await fetch("/api/restart", { method: "POST" });
    } catch (e) {
      console.error("Failed to restart preview server", e);
    } finally {
      if (iframeRef.current) {
        setLastReloadType("hard");
        iframeRef.current.src = iframeRef.current.src;
        setLastReloadType("hot");
      }
      setIsExecuting(false);
    }
  };

  const handleOverlayRun = () => {
    setIsRunning(true);
    handleHardRestart();
    setTimeout(() => { setIsRunning(false); }, 5500);
  };

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(`http://${publicUrl || currentUrl || "localhost:5000"}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return {
    currentUrl, setCurrentUrl, publicUrl, copied, isExecuting, setIsExecuting,
    urlInput, setUrlInput,
    showDevUrlPopup, setShowDevUrlPopup, devUrlPopupRef,
    privateDevUrl, setPrivateDevUrl,
    copiedDevLink, setCopiedDevLink,
    navigationHistoryRef, navigationIndexRef,
    handleIframeLoad, handleUrlInputSubmit,
    handleNavigateBack, handleNavigateForward,
    handleHardRestart, handleOverlayRun, handleCopyUrl,
  };
}
