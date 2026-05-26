/**
 * Client-side planning utilities for Agent
 * Communicates with server planning module
 */

export interface PlannerResponse {
  ideaAnalysis: any;
  architecture: any;
  buildPlan: any;
  testScenarios: any;
  executionPlan: any;
  verificationChecklist: any;
  formattedPlan: string;
}

export async function generatePlanFromIdea(idea: string): Promise<PlannerResponse> {
  try {
    const response = await fetch("/api/planning/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idea })
    });

    if (!response.ok) throw new Error("Planning generation failed");
    return await response.json();
  } catch (error) {
    console.error("Planning error:", error);
    throw error;
  }
}


// Internal planning engine API
export async function generateInternalPlan(idea: string, hours = 50) {
  const response = await fetch("/api/agent/plan", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idea, availableTimeHours: hours }),
  });
  if (!response.ok) throw new Error("Internal planning API failed");
  return response.json();
}
