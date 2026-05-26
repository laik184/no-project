import { AlertTriangle, ChevronLeft, ChevronRight, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ExecutionError {
  message: string;
  file?: string;
  line?: number;
  column?: number;
}

export interface ErrorPanelProps {
  errors: ExecutionError[];
  currentErrorIndex: number;
  errorExpanded: boolean;
  setCurrentErrorIndex: React.Dispatch<React.SetStateAction<number>>;
  setErrorExpanded: React.Dispatch<React.SetStateAction<boolean>>;
}

export function ErrorPanel({ errors, currentErrorIndex, errorExpanded, setCurrentErrorIndex, setErrorExpanded }: ErrorPanelProps) {
  if (errors.length === 0) return null;

  return (
    <div className="absolute bottom-0 left-0 right-0 bg-red-950/95 border-t-2 border-red-600">
      <div className="p-3 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-red-500" />
            <span className="text-sm font-semibold text-red-300">
              Error ({currentErrorIndex + 1} of {errors.length})
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Button size="icon" variant="ghost" className="h-6 w-6 text-red-400 hover:text-red-300 hover:bg-red-900/50"
              onClick={() => setCurrentErrorIndex(Math.max(0, currentErrorIndex - 1))}
              disabled={currentErrorIndex === 0} data-testid="button-prev-error">
              <ChevronLeft className="h-3 w-3" />
            </Button>
            <Button size="icon" variant="ghost" className="h-6 w-6 text-red-400 hover:text-red-300 hover:bg-red-900/50"
              onClick={() => setCurrentErrorIndex(Math.min(errors.length - 1, currentErrorIndex + 1))}
              disabled={currentErrorIndex === errors.length - 1} data-testid="button-next-error">
              <ChevronRight className="h-3 w-3" />
            </Button>
            <Button size="icon" variant="ghost" className="h-6 w-6 text-red-400 hover:text-red-300 hover:bg-red-900/50"
              onClick={() => setErrorExpanded(!errorExpanded)} data-testid="button-expand-error">
              <ChevronDown className={`h-3 w-3 transition-transform ${errorExpanded ? "rotate-180" : ""}`} />
            </Button>
          </div>
        </div>
        <div className="text-xs text-red-200 space-y-1 max-h-24 overflow-y-auto">
          <p className="font-mono">{errors[currentErrorIndex]?.message || "Unknown error"}</p>
          {errors[currentErrorIndex]?.file && (
            <p className="text-red-300">
              {errors[currentErrorIndex].file}:{errors[currentErrorIndex].line}:{errors[currentErrorIndex].column}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
