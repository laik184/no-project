import { useEffect, useState, useRef } from "react";
import { TabletFrame, OnePlusFrame, MobileFrame } from "./device-frames";

const PREVIEW_BASE = "http://localhost:3000";
const SSE_URL = "http://localhost:3000/__sse_reload";

const DEVICES = {
  desktop:  { w: "100%",  h: "100%"  },
  tablet:   { w: "800px", h: "450px" },
  oneplus:  { w: "840px", h: "600px" },
  mobile:   { w: "390px", h: "844px" },
};

const DEVICE_LABELS: Record<string, string> = {
  desktop: "Desktop",
  tablet:  "Tablet 16:9",
  oneplus: "OnePlus Pad Go 2",
  mobile:  "Mobile",
};

export default function PreviewView() {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [reloadCount, setReloadCount] = useState(0);
  const [status, setStatus] = useState<"online" | "offline">("offline");
  const [device, setDevice] = useState<keyof typeof DEVICES>("desktop");
  const [errorCount, setErrorCount] = useState(0);

  useEffect(() => {
    const ev = new EventSource(SSE_URL);
    ev.onopen = () => setStatus("online");
    ev.addEventListener("reload", () => {
      setReloadCount((c) => c + 1);
      if (iframeRef.current) {
        iframeRef.current.src = PREVIEW_BASE + "?t=" + Date.now();
      }
    });
    ev.onerror = () => { setStatus("offline"); setErrorCount((c) => c + 1); };
    return () => ev.close();
  }, []);

  const iframeEl = (
    <iframe
      ref={iframeRef}
      src={PREVIEW_BASE}
      className="w-full h-full border-0 bg-white"
      sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
    />
  );

  return (
    <div className="flex flex-col h-full bg-black text-white">
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-800 bg-[#0f172a]">
        <div className="flex items-center gap-3 text-xs">
          <span className="font-semibold">Live Preview</span>
          <span className={status === "online" ? "text-green-400" : "text-red-400"}>● {status}</span>
          <span className="text-gray-400">reloads: {reloadCount}</span>
          {errorCount > 0 && <span className="bg-red-500 text-white text-[10px] px-2 py-[2px] rounded">errors: {errorCount}</span>}
        </div>
        <div className="flex gap-1">
          {(["desktop", "tablet", "oneplus", "mobile"] as const).map((d) => (
            <button key={d} data-testid={`button-device-${d}`} onClick={() => setDevice(d)}
              className={`text-[10px] px-2 py-1 rounded border transition-colors ${device === d ? "bg-blue-500 border-blue-500 text-white" : "border-gray-600 text-gray-400 hover:border-gray-400"}`}>
              {DEVICE_LABELS[d]}
            </button>
          ))}
        </div>
      </div>

      <div style={{
        flex: 1, position: "relative", overflow: "auto",
        background: device === "desktop" ? "#000" : "radial-gradient(ellipse at 50% 50%, #060606 0%, #040404 55%, #000000 100%)",
      }}>
        {device === "desktop" ? (
          <div style={{ position: "absolute", inset: 0 }}>{iframeEl}</div>
        ) : (
          <div style={{ position: "relative", minHeight: "100%", display: "flex", alignItems: "center", justifyContent: "center", padding: "32px", boxSizing: "border-box" }}>
            {device === "tablet" && <TabletFrame>{iframeEl}</TabletFrame>}
            {device === "oneplus" && <OnePlusFrame>{iframeEl}</OnePlusFrame>}
            {device === "mobile" && <MobileFrame>{iframeEl}</MobileFrame>}
          </div>
        )}
      </div>
    </div>
  );
}
