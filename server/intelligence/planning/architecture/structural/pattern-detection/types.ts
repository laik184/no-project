export type ArchitectureType = "monolith" | "layered" | "modular" | "microservice";

export type ScoreLevel = "poor" | "average" | "good" | "excellent";

export interface PatternAnalysisInput {
  readonly files: readonly string[];
  readonly fileContents?: Readonly<Record<string, string>>;
}

export interface PatternAnalysisState {
  readonly files: readonly string[];
  readonly importGraph: Readonly<Record<string, readonly string[]>>;
  readonly modules: readonly string[];
  readonly detectedPatterns: readonly string[];
  readonly antiPatterns: readonly string[];
}

export interface ArchitectureClassification {
  readonly type: ArchitectureType;
  readonly confidence: number;
}

export interface LayeringReport {
  readonly layers: Readonly<Record<string, readonly string[]>>;
  readonly violations: readonly string[];
  readonly score: number;
}

export interface ModularityReport {
  readonly moduleCount: number;
  readonly independentModules: number;
  readonly cohesionScore: number;
  readonly couplingScore: number;
  readonly modularityScore: number;
}

export interface MicroserviceReport {
  readonly serviceCount: number;
  readonly independentServices: number;
  readonly boundaryViolations: readonly string[];
  readonly confidence: number;
}

export interface CouplingReport {
  readonly tightCouplingPairs: readonly string[];
  readonly dependencyClusters: readonly string[];
  readonly couplingScore: number;
}

export interface PatternScoreReport {
  readonly score: number;
  readonly level: ScoreLevel;
}

export interface ArchitecturePatternReport {
  readonly architectureType: string;
  readonly confidence: number;
  readonly antiPatterns: readonly string[];
  readonly couplingScore: number;
  readonly modularityScore: number;
  readonly finalScore: number;
}
