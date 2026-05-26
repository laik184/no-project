import { X, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { PortConfigModal } from "@/components/modals/port-config-modal";

interface Port {
  id: string;
  localAddress: string;
  localPort: string;
  externalPort: string;
  label?: string;
}

interface URLSharingModalProps {
  isOpen: boolean;
  onClose: () => void;
  publicUrl: string;
  currentPage?: "agent" | "console" | "publish" | "preview" | "grid";
}

export function URLSharingModal({ isOpen, onClose, publicUrl, currentPage = "preview" }: URLSharingModalProps) {
  const [copied, setCopied] = useState(false);
  const [selectedPort, setSelectedPort] = useState<"5000" | "41143">("5000");
  const [portCopied, setPortCopied] = useState(false);
  const [showPortConfig, setShowPortConfig] = useState(false);
  const [portsList, setPortsList] = useState<Port[]>([
    { id: "5000", localAddress: "0.0.0.0", localPort: ":5000", externalPort: ":80", label: "node" },
    { id: "41143", localAddress: "0.0.0.0", localPort: ":41143", externalPort: ":5173", label: "pid2" },
  ]);

  const ports = [
    { local: ":5000", external: ":80", id: "5000" as const },
    { local: ":41143", external: ":5173", id: "41143" as const },
  ];

  const handleAddPort = (newPort: Port) => {
    setPortsList([...portsList, newPort]);
  };

  const handleRemovePort = (id: string) => {
    setPortsList(portsList.filter((p) => p.id !== id));
  };

  useEffect(() => {
    if (!isOpen) {
      setCopied(false);
      setPortCopied(false);
    }
  }, [isOpen]);

  const handlePortCopy = (port: string) => {
    navigator.clipboard.writeText(port);
    setPortCopied(true);
    setTimeout(() => setPortCopied(false), 1500);
  };

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(fullUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen) return null;

  // Generate custom URL for this specific page
  const isLocal = publicUrl?.includes("localhost") || publicUrl?.includes("127.0.0.1");
  
  let fullUrl = "";
  if (isLocal) {
    // Local development URL
    fullUrl = `http://${publicUrl || "localhost:5000"}`;
  } else {
    // Custom generated URL for this page (not Replit's real domain)
    const randomId = Math.random().toString(36).substring(2, 8);
    fullUrl = `https://solopilot-${currentPage}-${randomId}.dev`;
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-[#0d0d0d] rounded-lg border border-gray-700 w-full max-w-md max-h-[80vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700 sticky top-0 bg-[#0d0d0d]">
          <h2 className="text-lg font-semibold text-gray-200">Share Preview</h2>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-gray-400 hover:text-gray-200"
            onClick={onClose}
            data-testid="button-close-url-modal"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Private Dev URL Section */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-200">Private Dev URL</span>
              <span className="px-2 py-1 bg-orange-500/20 text-orange-400 text-xs font-medium rounded">
                Teams
              </span>
            </div>
            <p className="text-xs text-gray-400">
              Restrict Dev URL access to authenticated editors only.
            </p>
            <p className="text-xs text-gray-500 mt-2">
              When this option is disabled, anyone with the Dev URL can access your workspace.
            </p>
          </div>

          {/* Listening on ports */}
          <div className="space-y-2 border-t border-gray-700 pt-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-200">Listening on ports:</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-gray-400 hover:text-gray-200"
                onClick={() => setShowPortConfig(true)}
                data-testid="button-port-settings"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </Button>
            </div>

            {/* Port mappings - Interactive */}
            <div className="space-y-2">
              {ports.map((port, idx) => (
                <button
                  key={port.id}
                  onClick={() => {
                    setSelectedPort(port.id);
                    handlePortCopy(`${port.local} → ${port.external}`);
                  }}
                  className={`w-full flex items-center gap-2 text-xs px-3 py-2 rounded cursor-pointer transition-all ${
                    selectedPort === port.id
                      ? "bg-gray-700 border border-gray-600"
                      : "bg-transparent border border-transparent hover:bg-gray-800"
                  }`}
                  data-testid={`button-port-${port.id}`}
                >
                  <div className={`w-2 h-2 rounded-full ${idx === 0 ? "bg-gray-600" : "bg-blue-500"}`}></div>
                  <span className="text-gray-400 flex-1 text-left">
                    {port.local} → {port.external}
                  </span>
                  {selectedPort === port.id && portCopied && (
                    <Check className="h-3 w-3 text-green-400" />
                  )}
                  {!(selectedPort === port.id && portCopied) && (
                    <Copy className="h-3 w-3 text-gray-500 opacity-0 group-hover:opacity-100" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Public Dev URL */}
          <div className="space-y-2 border-t border-gray-700 pt-4">
            <p className="text-xs font-medium text-gray-200">
              {isLocal ? "Local Dev URL" : `Page URL - ${currentPage.toUpperCase()}`}
            </p>
            <div className="bg-[#080808] rounded border border-gray-700 p-3 flex items-center justify-between gap-2">
              <span className="text-sm text-green-400 font-mono break-all text-xs">{fullUrl}</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-gray-400 hover:text-gray-200 flex-shrink-0"
                onClick={handleCopyUrl}
                data-testid="button-copy-public-url"
                title="Copy URL"
              >
                {copied ? (
                  <Check className="h-4 w-4 text-green-400" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
            <p className="text-xs text-gray-500">
              {isLocal 
                ? "Local development URL. Each page has a unique custom URL." 
                : "Custom generated URL for this page. Share with anyone!"}
            </p>
          </div>

          {/* QR Code Section */}
          <div className="border-t border-gray-700 pt-4">
            <p className="text-xs font-medium text-gray-200 mb-3">Quick Share</p>
            <div className="bg-white rounded p-8 flex justify-center items-center aspect-square">
              <div className="text-center">
                <p className="text-sm text-gray-700 font-mono break-all mb-2">{fullUrl}</p>
                <p className="text-xs text-gray-500">QR Code (Scan with camera to share)</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Port Config Modal */}
      <PortConfigModal
        isOpen={showPortConfig}
        onClose={() => setShowPortConfig(false)}
        ports={portsList}
        onAddPort={handleAddPort}
        onRemovePort={handleRemovePort}
      />
    </div>
  );
}
