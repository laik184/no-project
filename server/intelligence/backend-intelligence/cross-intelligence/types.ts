export interface AnalysisSignal {
  id: string;
  category: string;
  severity: "low" | "medium" | "high";
  message: string;
}

export interface CrossIntelligenceInput {
  signals: AnalysisSignal[];
}

export interface CorrelationResult {
  correlations: Record<string, string[]>;
}

export interface SynthesizedInsight {
  sourceSignal: string;
  relatedSignals: string[];
  summary: string;
  confidence: number;
}

export interface MultiSignalReport {
  totalSignals: number;
  categoryBreakdown: Record<string, number>;
  dominantCategory: string;
}

export interface CrossIntelligenceOutput {
  insights: SynthesizedInsight[];
  report: MultiSignalReport;
}
