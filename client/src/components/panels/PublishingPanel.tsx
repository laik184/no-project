import { useState } from "react";
import { Globe } from "lucide-react";
import { TABS } from "../publishing/types";
import { useDeployRunner } from "../publishing/use-deploy-runner";
import { DeployOverlayPanel } from "../publishing/DeployOverlayPanel";
import { OverviewTab } from "../publishing/OverviewTab";
import { LogsTab } from "../publishing/LogsTab";
import { ResourcesTab } from "../publishing/ResourcesTab";
import { DomainsTab } from "../publishing/DomainsTab";
import { ManageTab } from "../publishing/ManageTab";
import { AppSettingsPanel } from "../publishing/AppSettingsPanel";
import { SecurityScanPanel } from "../publishing/SecurityScanPanel";
import { AuthPanel } from "../publishing/AuthPanel";

export { AuthPanel };

export function PublishingPanel() {
  const [activeTab, setActiveTab] = useState<"overview" | "logs" | "resources" | "domains" | "manage">("overview");
  const [showSettings, setShowSettings] = useState(false);
  const [showSecurity, setShowSecurity] = useState(false);
  const [showAuth, setShowAuth]         = useState(false);
  const { deployState, startDeploy, retryDeploy, closePanel } = useDeployRunner();

  const isDeploying = deployState.active && !deployState.done;

  return (
    <div
      className="absolute inset-0 flex flex-col overflow-hidden"
      style={{ background: "hsl(222,30%,6%)", animation: "pub-fadein 0.2s ease" }}
    >
      <style>{`
        @keyframes pub-fadein {
          from { opacity:0; transform:translateY(5px); }
          to   { opacity:1; transform:translateY(0); }
        }
      `}</style>

      {/* Header */}
      <div
        className="flex items-center justify-between px-5 py-3 flex-shrink-0"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}
      >
        <div className="flex items-center gap-2">
          <Globe className="h-3.5 w-3.5" style={{ color: "rgba(148,163,184,0.55)" }} />
          <span className="text-xs font-semibold tracking-wide" style={{ color: "rgba(226,232,240,0.7)" }}>
            Publishing
          </span>
        </div>
      </div>

      {/* Tab bar */}
      <div
        className="flex items-center gap-0 px-5 flex-shrink-0"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}
      >
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="relative px-3.5 py-2.5 text-[12.5px] font-medium transition-colors duration-150"
              style={{ color: isActive ? "rgba(226,232,240,0.95)" : "rgba(100,116,139,0.7)" }}
              data-testid={`tab-publish-${tab.id}`}
            >
              {tab.label}
              {isActive && (
                <span
                  className="absolute bottom-0 left-0 right-0 h-px rounded-full"
                  style={{ background: "linear-gradient(90deg,#7c8dff,#a78bfa)" }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div
        className="flex-1 min-h-0"
        style={{
          overflowY: (activeTab === "logs" || activeTab === "resources") ? "hidden" : "auto",
          padding: "20px",
          scrollbarWidth: "thin",
          scrollbarColor: "rgba(255,255,255,0.08) transparent",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {activeTab === "overview"  && <OverviewTab onPublish={startDeploy} isDeploying={isDeploying} onSettings={() => setShowSettings(true)} onSecurity={() => setShowSecurity(true)} />}
        {activeTab === "logs"      && <LogsTab />}
        {activeTab === "resources" && <ResourcesTab />}
        {activeTab === "domains"   && <DomainsTab />}
        {activeTab === "manage"    && <ManageTab />}
      </div>

      {/* Deploy overlay — slides up on Republish */}
      {deployState.panelOpen && (
        <DeployOverlayPanel
          deployState={deployState}
          onRetry={retryDeploy}
          onClose={closePanel}
        />
      )}

      {/* App settings overlay */}
      {showSettings && <AppSettingsPanel onClose={() => setShowSettings(false)} />}

      {/* Security scan overlay */}
      {showSecurity && <SecurityScanPanel onClose={() => setShowSecurity(false)} />}

      {/* Auth panel overlay */}
      {showAuth && <AuthPanel onClose={() => setShowAuth(false)} />}
    </div>
  );
}
