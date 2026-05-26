import React from "react";
import { useAppState } from "@/context/app-state-context";

export default function ConsoleView() {
  const { consoleOutput } = useAppState();
  return (
    <div className="p-2 bg-black text-green-400 min-h-[200px] rounded">
      {consoleOutput?.length ? consoleOutput.map((l,i)=>(<div key={i}><pre className="whitespace-pre-wrap">{l}</pre></div>)) : <div className="text-sm text-gray-500">No logs yet</div>}
    </div>
  );
}
