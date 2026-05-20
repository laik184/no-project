export type Framework = "express" | "nestjs" | "react" | "next" | "vue";

export interface FileTreeNode {
  readonly name: string;
  readonly path: string;
  readonly type: "file" | "directory";
  readonly children?: readonly FileTreeNode[];
}

export type FileTree = readonly FileTreeNode[];

export interface DependencyNode {
  readonly id: string;
  readonly modulePath: string;
  readonly tags?: readonly string[];
}

export interface DependencyEdge {
  readonly from: string;
  readonly to: string;
  readonly type?: string;
}

export interface DependencyGraph {
  readonly nodes: readonly DependencyNode[];
  readonly edges: readonly DependencyEdge[];
}

export type Severity = "low" | "medium" | "high" | "critical";

export interface Pattern {
  readonly name: "mvc" | "layered" | "hexagonal" | "microservices";
  readonly confidence: number;
  readonly evidence: readonly string[];
}

export interface AntiPattern {
  readonly name:
    | "god class"
    | "fat controller"
    | "tight coupling"
    | "circular dependencies"
    | "deep nesting";
  readonly severity: Severity;
  readonly evidence: readonly string[];
}

export interface Violation {
  readonly rule: string;
  readonly severity: Severity;
  readonly location: string;
  readonly details: string;
}

export interface Suggestion {
  readonly title: string;
  readonly priority: Severity;
  readonly action: string;
}

export interface Score {
  readonly maintainability: number;
  readonly coupling: number;
  readonly scalability: number;
  readonly final: number;
}

export interface FrameworkPatternEngineInput {
  readonly projectStructure: FileTree;
  readonly framework: Framework;
  readonly codeGraph: DependencyGraph;
}

export interface FrameworkPatternEngineResult {
  readonly architectureType: string;
  readonly patterns: readonly Pattern[];
  readonly antiPatterns: readonly AntiPattern[];
  readonly violations: readonly Violation[];
  readonly suggestions: readonly Suggestion[];
  readonly score: number;
}

export interface FrameworkPatternEngineOutput {
  readonly success: boolean;
  readonly logs: readonly string[];
  readonly result: FrameworkPatternEngineResult;
  readonly error?: string;
}
