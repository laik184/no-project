import {
  createContext,
  useContext,
  useState,
  type ReactNode,
} from "react";
import { useRealtimeEvent } from "@/realtime/useRealtimeStream";

export type AgentMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
};

export type ExecutionError = { message: string; file?: string; line?: number; column?: number; type: string };
export type ExecutionState = { status: string; errors: ExecutionError[] };

type AppStateContextValue = {
  messages: AgentMessage[];
  setMessages: React.Dispatch<React.SetStateAction<AgentMessage[]>>;

  consoleOutput: string[];

  /** Always { status:"idle", errors:[] } — ExecutionClient removed; kept for API compatibility. */
  executionState: ExecutionState;

  subdomain: string;
  setSubdomain: React.Dispatch<React.SetStateAction<string>>;

  isRunning: boolean;
  setIsRunning: React.Dispatch<React.SetStateAction<boolean>>;
};

const AppStateContext = createContext<AppStateContextValue | undefined>(undefined);

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [messages,      setMessages]      = useState<AgentMessage[]>([]);
  const [consoleOutput, setConsoleOutput] = useState<string[]>([]);
  const [subdomain,     setSubdomain]     = useState("");
  const [isRunning,     setIsRunning]     = useState(false);

  useRealtimeEvent("console", (data) => {
    try {
      const e    = data as Record<string, unknown>;
      const text =
        (e.line    as string | undefined) ??
        (e.text    as string | undefined) ??
        (e.message as string | undefined) ??
        JSON.stringify(e);
      setConsoleOutput((prev) => [...prev, String(text)].slice(-1000));
    } catch {
      setConsoleOutput((prev) => [...prev, String(data)].slice(-1000));
    }
  });

  const executionState: ExecutionState = { status: "idle", errors: [] };

  return (
    <AppStateContext.Provider
      value={{ messages, setMessages, consoleOutput, executionState, subdomain, setSubdomain, isRunning, setIsRunning }}
    >
      {children}
    </AppStateContext.Provider>
  );
}

export function useAppState() {
  const ctx = useContext(AppStateContext);
  if (!ctx) throw new Error("useAppState must be used within an AppStateProvider");
  return ctx;
}
