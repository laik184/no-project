import { useState, useRef, useCallback } from "react";
import { useAppState } from "@/context/app-state-context";
import { GridPreviewPage } from "@/pages/grid/grid-preview-page";
import { GridAgentPage } from "@/pages/grid/grid-agent-page";
import { GridConsolePage } from "@/pages/grid/grid-console-page";
import { GridPublishingPage } from "@/pages/grid/grid-publishing-page";
import { FilesModal } from "@/components/modals/files-modal";
import { URLSharingModal } from "@/components/modals/url-sharing-modal";
import { DevToolsPanel } from "./PreviewPanel";
import { usePreviewCapture } from "@/hooks/usePreviewCapture";
import { BrowserBar } from "./BrowserBar";
import { ErrorPanel } from "./ErrorPanel";
import { GridToolbar } from "@/pages/grid/GridToolbar";
import { IframeView } from "./IframeView";
import { useDeviceLogic } from "@/hooks/useDeviceLogic";
import { useNavigationLogic } from "@/hooks/useNavigationLogic";
import { useDevToolsLogic } from "@/hooks/useDevToolsLogic";
import { useInspectLogic } from "@/hooks/useInspectLogic";
import { usePreviewLifecycle } from "./lifecycle/usePreviewLifecycle";
import { useIframeAutoRefresh } from "./lifecycle/useIframeAutoRefresh";
import { PreviewStatusPill } from "./lifecycle/PreviewStatusPill";
import { RuntimeHealthWidget } from "./RuntimeHealthWidget";
import "./preview-animations.css";

export default function Preview() {
  const { executionState, isRunning, setIsRunning } = useAppState();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const touchStartX = useRef(0);

  const [gridMode, setGridMode] = useState(false);
  const [currentPageIndex, setCurrentPageIndex] = useState(2);
  const [searchQuery, setSearchQuery] = useState("");
  const [showFilesModal, setShowFilesModal] = useState(false);
  const [showUrlModal, setShowUrlModal] = useState(false);
  const [iframeKey, setIframeKey] = useState(0);
  const [autoReloadEnabled] = useState(true);
  const [crashReason, setCrashReason] = useState<string | null>(null);
  const [lastAction] = useState<string | null>(null);
  const [lastReloadType, setLastReloadType] = useState<"hot" | "hard" | null>(null);
  const [errorExpanded, setErrorExpanded] = useState(false);
  const [currentErrorIndex, setCurrentErrorIndex] = useState(0);
  const [networkMode, setNetworkMode] = useState<"normal" | "slow" | "offline">("normal");
  const [followSharedPreview, setFollowSharedPreview] = useState(false);
  const [devToolsTab, setDevToolsTab] = useState<any>("console");

  // ── Lifecycle system ──────────────────────────────────────────────────────
  const { snapshot: lifecycle } = usePreviewLifecycle({
    onStateChange: (s) => {
      if (s.state === "crashed") {
        setCrashReason(s.message);
      } else if (s.state === "ready") {
        setCrashReason(null);
      }
    },
  });

  // Auto-refresh iframe on key transitions
  useIframeAutoRefresh({
    state:       lifecycle.state,
    prevState:   lifecycle.prevState,
    setIframeKey,
    delayMs:     600,
  });

  const handleRetry = useCallback(() => {
    setIframeKey(k => k + 1);
  }, []);

  const device = useDeviceLogic();

  const nav = useNavigationLogic({
    iframeRef,
    executionState,
    autoReloadEnabled,
    isRunning,
    setIsRunning,
    setIframeKey,
    setLastReloadType,
    setCrashReason,
  });

  const tools = useDevToolsLogic({
    networkMode,
    followSharedPreview,
    setCurrentUrl: nav.setCurrentUrl,
    setUrlInput: nav.setUrlInput,
    setDeviceType: device.setDeviceType,
    setDevToolsTab,
    setGridMode,
    setIframeKey,
  });

  const inspect = useInspectLogic(iframeRef);

  usePreviewCapture(iframeRef, {
    setConsoleLogs: tools.setConsoleLogs,
    setNetworkRequests: tools.setNetworkRequests,
    setDomElements: tools.setDomElements,
  });

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) {
      if (diff > 0 && currentPageIndex < 3) setCurrentPageIndex(currentPageIndex + 1);
      else if (diff < 0 && currentPageIndex > 0) setCurrentPageIndex(currentPageIndex - 1);
    }
  };
  const handleTouchMove = (e: React.TouchEvent) => {
    const diff = Math.abs(touchStartX.current - e.touches[0].clientX);
    if (diff < 20) return;
  };

  const renderGridModeContent = () => {
    if (currentPageIndex === 0) return <GridConsolePage />;
    if (currentPageIndex === 1) return <GridAgentPage />;
    if (currentPageIndex === 2) return <GridPreviewPage />;
    if (currentPageIndex === 3) return <GridPublishingPage />;
  };

  return (
    <div className={`flex-1 flex flex-col h-screen bg-black overflow-hidden transition-all duration-300 ease-in-out ${gridMode ? "translate-y-[-40px]" : "translate-y-0"}`}>
      {gridMode && <div className="fixed inset-0 bg-black/40 z-20 pointer-events-none" />}

      <div
        className={`flex-1 flex flex-col overflow-hidden ${gridMode ? "mx-2 sm:mx-4 my-4 rounded-t-2xl sm:rounded-t-3xl border-2 border-gray-700 bg-black" : ""}`}
        onTouchStart={gridMode ? handleTouchStart : undefined}
        onTouchEnd={gridMode ? handleTouchEnd : undefined}
        onTouchMove={gridMode ? handleTouchMove : undefined}
      >
        {!gridMode ? (
          <>
            <BrowserBar
              navigationIndexRef={nav.navigationIndexRef}
              navigationHistoryRef={nav.navigationHistoryRef}
              handleNavigateBack={nav.handleNavigateBack}
              handleNavigateForward={nav.handleNavigateForward}
              iframeRef={iframeRef}
              setIsExecuting={nav.setIsExecuting}
              setConsoleLogs={tools.setConsoleLogs}
              setNetworkRequests={tools.setNetworkRequests}
              setLastReloadType={setLastReloadType}
              showDevUrlPopup={nav.showDevUrlPopup}
              setShowDevUrlPopup={nav.setShowDevUrlPopup}
              devUrlPopupRef={nav.devUrlPopupRef}
              publicUrl={nav.publicUrl}
              currentUrl={nav.currentUrl}
              privateDevUrl={nav.privateDevUrl}
              setPrivateDevUrl={nav.setPrivateDevUrl}
              copiedDevLink={nav.copiedDevLink}
              setCopiedDevLink={nav.setCopiedDevLink}
              urlInput={nav.urlInput}
              setUrlInput={nav.setUrlInput}
              handleUrlInputSubmit={nav.handleUrlInputSubmit}
              devToolsOpen={tools.devToolsOpen}
              setDevToolsOpen={tools.setDevToolsOpen}
              selectedDevice={device.selectedDevice}
              showDevicePopup={device.showDevicePopup}
              setShowDevicePopup={device.setShowDevicePopup}
              devicePopupRef={device.devicePopupRef}
              handleSelectDevice={device.handleSelectDevice}
            >
              {/* Status pill + runtime health sit inside the browser bar */}
              <PreviewStatusPill state={lifecycle.state} />
              <RuntimeHealthWidget projectId={lifecycle.meta?.projectId as number | undefined} />
            </BrowserBar>

            <main className="flex-1 overflow-hidden bg-black relative flex flex-col">
              <IframeView
                iframeRef={iframeRef}
                iframeKey={iframeKey}
                selectedDevice={device.selectedDevice}
                customWidth={device.customWidth}
                customHeight={device.customHeight}
                previewContainerRef={device.previewContainerRef}
                isExecuting={nav.isExecuting}
                isRunning={isRunning}
                onIframeLoad={nav.handleIframeLoad}
                onSelectDevice={device.handleSelectDevice}
                onResizeDragStart={device.handleResizeDragStart}
                onResetCustomSize={() => { device.setCustomWidth(null); device.setCustomHeight(null); }}
                onPlayClick={() => nav.setIsExecuting(!nav.isExecuting)}
                onOverlayRun={() => nav.handleOverlayRun(lifecycle.meta?.projectId as number | undefined)}
                lifecycleState={lifecycle.state}
                lifecyclePrev={lifecycle.prevState}
                lifecycleMessage={lifecycle.message}
                lifecycleMeta={lifecycle.meta}
                onRetry={handleRetry}
                onRun={() => nav.handleOverlayRun(lifecycle.meta?.projectId as number | undefined)}
              />

              <ErrorPanel
                errors={executionState.errors}
                currentErrorIndex={currentErrorIndex}
                errorExpanded={errorExpanded}
                setCurrentErrorIndex={setCurrentErrorIndex}
                setErrorExpanded={setErrorExpanded}
              />

              <DevToolsPanel
                devToolsOpen={tools.devToolsOpen}
                devToolsMinimized={tools.devToolsMinimized}
                devToolsHeight={tools.devToolsHeight}
                devToolsTab={devToolsTab}
                consoleLogs={tools.consoleLogs}
                networkRequests={tools.networkRequests}
                networkMode={networkMode}
                followSharedPreview={followSharedPreview}
                inspectMode={inspect.inspectMode}
                selectedElementInfo={inspect.selectedElementInfo}
                setDevToolsOpen={tools.setDevToolsOpen}
                setDevToolsMinimized={tools.setDevToolsMinimized}
                setDevToolsTab={setDevToolsTab}
                setConsoleLogs={tools.setConsoleLogs}
                setNetworkRequests={tools.setNetworkRequests}
                setNetworkMode={setNetworkMode}
                setFollowSharedPreview={setFollowSharedPreview}
                setSelectedElementInfo={inspect.setSelectedElementInfo}
                handleDevToolsResizeMouseDown={tools.handleDevToolsResizeMouseDown}
              />
            </main>
          </>
        ) : (
          renderGridModeContent()
        )}
      </div>

      {gridMode && (
        <GridToolbar
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          setGridMode={setGridMode}
        />
      )}

      <FilesModal isOpen={showFilesModal} onClose={() => setShowFilesModal(false)} />
      <URLSharingModal
        isOpen={showUrlModal}
        onClose={() => setShowUrlModal(false)}
        publicUrl={nav.publicUrl}
        currentPage="preview"
      />
    </div>
  );
}
