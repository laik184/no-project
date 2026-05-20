export type ProjectType = "monolith" | "microservice" | "modular";
export type ProjectSize = "small" | "medium" | "large";

export type FrameworkName = "Express" | "NestJS" | "Django" | "Spring";
export type ArchitectureStyle = "MVC" | "Layered" | "Hexagonal";

export type BusinessDomain =
  | "SaaS"
  | "Fintech"
  | "Ecommerce"
  | "Realtime"
  | "Healthcare"
  | "HR"
  | "Education"
  | "Logistics"
  | "Gaming"
  | "IoT"
  | "Legal"
  | "RealEstate"
  | "Media"
  | "CRM"
  | "Inventory"
  | "Marketplace"
  | "ProjectManagement"
  | "Social"
  | "Booking"
  | "Analytics"
  | "Auth"
  | "Custom";

export type RiskLevel = "low" | "medium" | "high";
export type DataSensitivity = "low" | "high";

export type Runtime = "Node" | "Python" | "JVM";
export type Deployment = "server" | "serverless" | "container";
export type Scaling = "horizontal" | "vertical";

export interface BackendSignalInput {
  readonly filePaths: readonly string[];
  readonly dependencies: readonly string[];
  readonly configKeys: readonly string[];
  readonly serviceCount: number;
  readonly moduleCount: number;
  readonly endpointCount: number;
}

// ── Normalized form of BackendSignalInput after sanitization ──────────────────
//
// Defined here (not in normalization.util) so all agents and map utils
// can import it from a single, stable contract file without coupling
// to the normalization utility.

export interface NormalizedSignals {
  readonly filePaths: readonly string[];
  readonly dependencies: readonly string[];
  readonly configKeys: readonly string[];
  readonly serviceCount: number;
  readonly moduleCount: number;
  readonly endpointCount: number;
}

export interface ProjectContext {
  readonly type: ProjectType;
  readonly size: ProjectSize;
  readonly complexity: number;
}

export interface FrameworkContext {
  readonly framework: FrameworkName;
  readonly style: ArchitectureStyle;
  readonly typeSafety: boolean;
}

export interface DomainContext {
  readonly domain: BusinessDomain;
  readonly riskLevel: RiskLevel;
  readonly dataSensitivity: DataSensitivity;
}

export interface EnvironmentContext {
  readonly runtime: Runtime;
  readonly deployment: Deployment;
  readonly scaling: Scaling;
}

export interface BackendContext {
  readonly project: ProjectContext;
  readonly framework: FrameworkContext;
  readonly domain: DomainContext;
  readonly environment: EnvironmentContext;
}
