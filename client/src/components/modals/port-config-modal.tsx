import { X, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";

interface Port {
  id: string;
  localAddress: string;
  localPort: string;
  externalPort: string;
  label?: string;
}

interface PortConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  ports: Port[];
  onAddPort: (port: Port) => void;
  onRemovePort: (id: string) => void;
}

export function PortConfigModal({
  isOpen,
  onClose,
  ports,
  onAddPort,
  onRemovePort,
}: PortConfigModalProps) {
  const [newLocalPort, setNewLocalPort] = useState("");
  const [newExternalPort, setNewExternalPort] = useState("");

  if (!isOpen) return null;

  const handleAddPort = () => {
    if (newLocalPort && newExternalPort) {
      const newPort: Port = {
        id: Date.now().toString(),
        localAddress: "0.0.0.0",
        localPort: newLocalPort.startsWith(":") ? newLocalPort : `:${newLocalPort}`,
        externalPort: newExternalPort.startsWith(":") ? newExternalPort : `:${newExternalPort}`,
      };
      onAddPort(newPort);
      setNewLocalPort("");
      setNewExternalPort("");
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-[#0d0d0d] rounded-lg border border-gray-700 w-full max-w-2xl max-h-[80vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700 sticky top-0 bg-[#0d0d0d]">
          <h2 className="text-lg font-semibold text-gray-200">Port Configuration</h2>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-gray-400 hover:text-gray-200"
            onClick={onClose}
            data-testid="button-close-port-config"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Ports Table */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-gray-200 mb-3">Listening Ports</p>
            {ports.length === 0 ? (
              <div className="bg-gray-900/50 rounded p-4 text-center">
                <p className="text-xs text-gray-500">No ports configured yet</p>
              </div>
            ) : (
              <div className="space-y-2 border border-gray-700 rounded overflow-hidden">
                {ports.map((port) => (
                  <div
                    key={port.id}
                    className="flex items-center justify-between gap-4 p-3 hover:bg-gray-800/50 transition-colors border-b border-gray-700 last:border-b-0"
                    data-testid={`port-item-${port.id}`}
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <span className="text-xs font-mono text-gray-400">
                        {port.localAddress}{port.localPort}
                      </span>
                      <span className="text-gray-600">→</span>
                      <span className="text-xs font-mono text-green-400 font-semibold">
                        {port.externalPort}
                      </span>
                    </div>
                    {port.label && (
                      <span className="text-xs text-gray-500 px-2 py-1 bg-gray-800 rounded">
                        {port.label}
                      </span>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5 text-gray-400 hover:text-red-400 flex-shrink-0"
                      onClick={() => onRemovePort(port.id)}
                      data-testid={`button-remove-port-${port.id}`}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Add New Port */}
          <div className="border-t border-gray-700 pt-4 space-y-3">
            <p className="text-xs font-medium text-gray-200">Add New Port</p>
            <div className="flex gap-2 items-end">
              <div className="flex-1 min-w-0">
                <label className="text-xs text-gray-400 block mb-1">Local Port</label>
                <Input
                  type="text"
                  placeholder="3000"
                  value={newLocalPort}
                  onChange={(e) => setNewLocalPort(e.target.value)}
                  className="bg-gray-800 border border-gray-700 text-white placeholder:text-gray-500 text-sm"
                  data-testid="input-new-local-port"
                />
              </div>
              <div className="flex items-center justify-center px-2 pb-1 text-gray-600">→</div>
              <div className="flex-1 min-w-0">
                <label className="text-xs text-gray-400 block mb-1">External Port</label>
                <Input
                  type="text"
                  placeholder="3000"
                  value={newExternalPort}
                  onChange={(e) => setNewExternalPort(e.target.value)}
                  className="bg-gray-800 border border-gray-700 text-white placeholder:text-gray-500 text-sm"
                  data-testid="input-new-external-port"
                />
              </div>
              <Button
                onClick={handleAddPort}
                className="bg-blue-600 hover:bg-blue-700 text-white h-9 flex-shrink-0"
                data-testid="button-add-new-port"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Info */}
          <div className="bg-gray-900/50 rounded p-3 border border-gray-800">
            <p className="text-xs text-gray-400">
              This port configuration is saved in the <span className="font-mono text-gray-300">.replit</span> file.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
