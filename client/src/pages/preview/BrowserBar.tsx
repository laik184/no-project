import React from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  ArrowLeft, ArrowRight, RotateCw, Link as LinkIcon,
  Settings, Check, Copy, Monitor, ExternalLink, Wrench, ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DEVICE_CONFIGS, DEVICE_GROUPS, type DeviceKey } from "./preview-types";

export interface BrowserBarProps {
  navigationIndexRef: React.MutableRefObject<number>;
  navigationHistoryRef: React.MutableRefObject<string[]>;
  handleNavigateBack: () => void;
  handleNavigateForward: () => void;
  iframeRef: React.RefObject<HTMLIFrameElement>;
  setIsExecuting: React.Dispatch<React.SetStateAction<boolean>>;
  setConsoleLogs: React.Dispatch<React.SetStateAction<Array<{ type: string; message: string; time: string }>>>;
  setNetworkRequests: React.Dispatch<React.SetStateAction<Array<{ method: string; url: string; status: string; type: string; time: string }>>>;
  setLastReloadType: React.Dispatch<React.SetStateAction<"hot" | "hard" | null>>;
  showDevUrlPopup: boolean;
  setShowDevUrlPopup: React.Dispatch<React.SetStateAction<boolean>>;
  devUrlPopupRef: React.RefObject<HTMLDivElement>;
  publicUrl: string;
  currentUrl: string;
  privateDevUrl: boolean;
  setPrivateDevUrl: React.Dispatch<React.SetStateAction<boolean>>;
  copiedDevLink: boolean;
  setCopiedDevLink: React.Dispatch<React.SetStateAction<boolean>>;
  urlInput: string;
  setUrlInput: React.Dispatch<React.SetStateAction<string>>;
  handleUrlInputSubmit: (e: React.FormEvent) => void;
  devToolsOpen: boolean;
  setDevToolsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  selectedDevice: DeviceKey;
  showDevicePopup: boolean;
  setShowDevicePopup: React.Dispatch<React.SetStateAction<boolean>>;
  devicePopupRef: React.RefObject<HTMLDivElement>;
  handleSelectDevice: (key: DeviceKey) => void;
  /** Optional extra content injected after the DevTools button (e.g. status pill). */
  children?: React.ReactNode;
}

export function BrowserBar({
  navigationIndexRef, navigationHistoryRef, handleNavigateBack, handleNavigateForward,
  iframeRef, setIsExecuting, setConsoleLogs, setNetworkRequests, setLastReloadType,
  showDevUrlPopup, setShowDevUrlPopup, devUrlPopupRef,
  publicUrl, currentUrl, privateDevUrl, setPrivateDevUrl, copiedDevLink, setCopiedDevLink,
  urlInput, setUrlInput, handleUrlInputSubmit,
  devToolsOpen, setDevToolsOpen,
  selectedDevice, showDevicePopup, setShowDevicePopup, devicePopupRef, handleSelectDevice,
  children,
}: BrowserBarProps) {
  return (
    <div className="bg-black border-b border-gray-700 px-3 sm:px-4 py-2 flex-shrink-0 relative z-50">
      <div className="flex items-center gap-1 sm:gap-1.5">
        <Button
          variant="ghost" size="icon"
          className="h-7 w-7 text-gray-400 hover:text-gray-200 hover:bg-gray-700 rounded disabled:opacity-30 disabled:cursor-not-allowed"
          data-testid="button-back-nav"
          onClick={handleNavigateBack}
          disabled={navigationIndexRef.current <= 0}
          title="Go back"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost" size="icon"
          className="h-7 w-7 text-gray-400 hover:text-gray-200 hover:bg-gray-700 rounded disabled:opacity-30 disabled:cursor-not-allowed"
          data-testid="button-forward-nav"
          onClick={handleNavigateForward}
          disabled={navigationIndexRef.current >= navigationHistoryRef.current.length - 1}
          title="Go forward"
        >
          <ArrowRight className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost" size="icon"
          className="h-7 w-7 text-gray-400 hover:text-gray-200 hover:bg-gray-700 rounded transition-transform hover:rotate-180 duration-300"
          data-testid="button-refresh"
          onClick={() => {
            setIsExecuting(true);
            setConsoleLogs([]);
            setNetworkRequests([]);
            if (iframeRef.current) {
              iframeRef.current.src = iframeRef.current.src;
              setLastReloadType("hot");
            }
          }}
          title="Refresh preview"
        >
          <RotateCw className="h-3.5 w-3.5" />
        </Button>

        {/* Dev URL popup */}
        <div className="relative" ref={devUrlPopupRef}>
          <button
            onClick={() => setShowDevUrlPopup(v => !v)}
            className="flex items-center justify-center h-7 w-7 rounded transition-all duration-150 hover:bg-gray-700 flex-shrink-0 text-gray-400 hover:text-gray-200"
            title="Dev URL settings"
            data-testid="button-dev-url-chain"
          >
            <LinkIcon className="h-3.5 w-3.5" />
          </button>
          {showDevUrlPopup && (() => {
            const devUrl = publicUrl ? `https://${publicUrl}` : `http://localhost:5000`;
            return (
              <div
                className="absolute left-0 top-full mt-1.5 z-50 rounded-lg overflow-hidden"
                style={{ background: "#1a1d27", border: "1px solid rgba(255,255,255,0.1)", boxShadow: "0 8px 24px rgba(0,0,0,0.55)", width: "260px" }}
              >
                <div className="px-3 pt-3 pb-2">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <p className="text-[11.5px] font-semibold text-white">Private Dev URL</p>
                    <button
                      onClick={() => setPrivateDevUrl(v => !v)}
                      className="relative flex-shrink-0 rounded-full transition-all duration-300"
                      style={{ minWidth: "32px", width: "32px", height: "18px", background: privateDevUrl ? "#3b82f6" : "rgba(255,255,255,0.15)" }}
                      data-testid="toggle-private-dev-url"
                    >
                      <span className="absolute top-0.5 w-3.5 h-3.5 rounded-full bg-white transition-all duration-300"
                        style={{ left: privateDevUrl ? "calc(100% - 16px)" : "1px", boxShadow: "0 1px 2px rgba(0,0,0,0.3)" }} />
                    </button>
                  </div>
                  <p className="text-[10px] leading-relaxed" style={{ color: "rgba(148,163,184,0.65)" }}>
                    {privateDevUrl ? "Only authenticated editors can access the Dev URL." : "Anyone with the Dev URL can access your app preview."}
                  </p>
                </div>
                <div style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }} />
                <div className="px-3 py-2 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10.5px] font-medium" style={{ color: "rgba(148,163,184,0.7)" }}>Port:</span>
                    <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" style={{ boxShadow: "0 0 4px rgba(59,130,246,0.8)" }} />
                    <span className="text-[11px] font-mono font-semibold text-white">:5000 → :80</span>
                  </div>
                  <button className="p-0.5 rounded transition-colors hover:bg-gray-700" style={{ color: "rgba(148,163,184,0.5)" }} title="Port settings" data-testid="button-port-settings">
                    <Settings className="h-3 w-3" />
                  </button>
                </div>
                <div style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }} />
                <div className="px-3 py-2">
                  <div className="flex items-center gap-1.5">
                    <a href={devUrl} target="_blank" rel="noopener noreferrer" className="flex-1 text-[10px] font-mono truncate hover:underline" style={{ color: "#4ade80" }} data-testid="link-dev-url">
                      {devUrl}
                    </a>
                    <button
                      onClick={() => { navigator.clipboard.writeText(devUrl); setCopiedDevLink(true); setTimeout(() => setCopiedDevLink(false), 2000); }}
                      className="flex-shrink-0 p-1 rounded transition-all duration-150 hover:bg-gray-700"
                      style={{ color: copiedDevLink ? "#4ade80" : "rgba(148,163,184,0.55)" }}
                      title="Copy URL" data-testid="button-copy-dev-url"
                    >
                      {copiedDevLink ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                    </button>
                  </div>
                  <p className="text-[9.5px] mt-1" style={{ color: "rgba(100,116,139,0.6)" }}>Temporary — sleeps when you leave.</p>
                </div>
                <div style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }} />
                <div className="px-3 py-2">
                  <div className="p-1.5 rounded bg-white inline-block">
                    <QRCodeSVG value={devUrl} size={80} bgColor="#ffffff" fgColor="#000000" level="M" />
                  </div>
                </div>
              </div>
            );
          })()}
        </div>

        {/* URL input */}
        <div className="flex-1 flex items-center bg-black rounded px-2.5 py-1 min-w-0 mx-1">
          <form className="w-full" onSubmit={handleUrlInputSubmit}>
            <Input
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              className="w-full h-6 bg-transparent border-none px-0 text-[11px] text-gray-300 placeholder:text-gray-500 focus-visible:ring-0 focus-visible:ring-offset-0"
              data-testid="input-preview-url"
              spellCheck={false}
            />
          </form>
        </div>

        {/* DevTools toggle */}
        <Button
          variant="ghost" size="icon"
          className={`h-7 w-7 rounded ${devToolsOpen ? "bg-blue-600 text-white" : "text-gray-400 hover:text-gray-200 hover:bg-gray-700"}`}
          onClick={() => setDevToolsOpen(!devToolsOpen)}
          data-testid="button-devtools"
          title="Developer tools"
        >
          <Wrench className="h-3.5 w-3.5" />
        </Button>

        {/* Device selector */}
        <div className="relative" ref={devicePopupRef}>
          <button
            className="flex items-center gap-1 px-2 h-7 rounded cursor-pointer"
            style={{ background: "rgba(59,130,246,0.12)", border: "1px solid rgba(59,130,246,0.25)" }}
            data-testid="device-indicator"
            title={DEVICE_CONFIGS[selectedDevice]?.label ?? "Device"}
            onClick={() => setShowDevicePopup(v => !v)}
          >
            <Monitor className="h-3 w-3 text-blue-400" />
          </button>
          {showDevicePopup && (
            <div
              className="absolute right-0 top-full mt-1 z-50 rounded-lg overflow-hidden py-1"
              style={{ background: "#1a1d27", border: "1px solid rgba(255,255,255,0.1)", boxShadow: "0 8px 24px rgba(0,0,0,0.5)", minWidth: 180 }}
            >
              {DEVICE_GROUPS.map(group => (
                <div key={group.groupLabel}>
                  <div className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                    {group.groupLabel}
                  </div>
                  {group.keys.map(key => (
                    <button
                      key={key}
                      className="w-full text-left px-3 py-1.5 text-[12px] flex items-center justify-between gap-2 hover:bg-white/5 transition-colors"
                      style={{ color: selectedDevice === key ? "#60a5fa" : "#d1d5db" }}
                      onClick={() => handleSelectDevice(key)}
                    >
                      <span>{DEVICE_CONFIGS[key].label}</span>
                      {DEVICE_CONFIGS[key].dims && (
                        <span className="text-[10px] text-gray-500">{DEVICE_CONFIGS[key].dims}</span>
                      )}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Open in new tab */}
        <Button
          variant="ghost" size="icon"
          onClick={() => window.open(`http://${publicUrl || currentUrl || "localhost:5000"}`, "_blank")}
          className="h-7 w-7 text-gray-400 hover:text-gray-200 hover:bg-gray-700 rounded"
          data-testid="button-open-external"
          title="Open in new tab"
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </Button>

        {/* Injected slot — status pill, etc. */}
        {children}
      </div>
    </div>
  );
}
