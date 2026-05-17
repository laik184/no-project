import {
  createContext,
  useContext,
  useState,
  type ReactNode,
} from "react";
import { ExecutionClient, type ExecutionUpdate } from "@/lib/execution-client";
import { useRealtimeEvent } from "@/realtime/useRealtimeStream";

export type AgentMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
};

export type ExecutionState = {
  status: string;
  errors: ExecutionUpdate["errors"];
};

type AppStateContextValue = {
  messages: AgentMessage[];
  setMessages: React.Dispatch<React.SetStateAction<AgentMessage[]>>;

  consoleOutput: string[];
  subdomain: string;
  setSubdomain: React.Dispatch<React.SetStateAction<string>>;

  isRunning: boolean;
  setIsRunning: React.Dispatch<React.SetStateAction<boolean>>;

  executionClient: ExecutionClient;
  executionState: ExecutionState;
  setExecutionState: React.Dispatch<React.SetStateAction<ExecutionState>>;
};

const AppStateContext = createContext<AppStateContextValue | undefined>(
  undefined,
);

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [consoleOutput, setConsoleOutput] = useState<string[]>([]);

  useRealtimeEvent("console", (data) => {
    try {
      const parsed = data as Record<string, unknown>;
      const text =
        (parsed.line as string) ??
        (parsed.text as string) ??
        (parsed.message as string) ??
        JSON.stringify(parsed);
      setConsoleOutput((prev) => [...prev, String(text)].slice(-1000));
    } catch {
      setConsoleOutput((prev) => [...prev, String(data)].slice(-1000));
    }
  });

  const [subdomain, setSubdomain] = useState("");
  const [isRunning, setIsRunning] = useState(false);

  const [executionState, setExecutionState] = useState<ExecutionState>({
    status: "idle",
    errors: [],
  });

  const [executionClient] = useState(() => new ExecutionClient());

  const value: AppStateContextValue = {
    messages,
    setMessages,
    consoleOutput,
    subdomain,
    setSubdomain,
    isRunning,
    setIsRunning,
    executionClient,
    executionState,
    setExecutionState,
  };

  return (
    <AppStateContext.Provider value={value}>
      {children}
    </AppStateContext.Provider>
  );
}

export function useAppState() {
  const ctx = useContext(AppStateContext);
  if (!ctx) {
    throw new Error("useAppState must be used within an AppStateProvider");
  }
  return ctx;
}
