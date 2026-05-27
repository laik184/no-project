export interface IntentNode {
  id:          string;
  intent:      string;
  dependencies: string[];
  priority:    number;
}

export interface IntentGraph {
  nodes:   IntentNode[];
  rootIds: string[];
}

export interface IntentEdge {
  from: string;
  to:   string;
}
