import { CrossIntelligenceOutput } from "./types";

export interface CrossIntelligenceState {
  status: "idle" | "running" | "done" | "error";
  result: CrossIntelligenceOutput | null;
  error: string | null;
}

export const initialState: CrossIntelligenceState = {
  status: "idle",
  result: null,
  error: null,
};
