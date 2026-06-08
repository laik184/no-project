/**
 * dom-inspector.ts — Server-side DOM element inspection data store.
 * Receives inspected element data forwarded from the iframe.
 */

export interface ComputedStyle {
  property: string;
  value:    string;
}

export interface BoxModel {
  top:     number;
  right:   number;
  bottom:  number;
  left:    number;
  width:   number;
  height:  number;
}

export interface InspectedElement {
  tagName:        string;
  id:             string | null;
  className:      string | null;
  innerHTML:      string;
  outerHTML:      string;
  computedStyles: ComputedStyle[];
  boxModel:       BoxModel | null;
  attributes:     Record<string, string>;
  capturedAt:     number;
}

// In-memory: one inspected element per projectId
const inspectedElements = new Map<number, InspectedElement>();

export const domInspector = {
  store(projectId: number, element: Omit<InspectedElement, "capturedAt">): void {
    inspectedElements.set(projectId, {
      ...element,
      capturedAt: Date.now(),
    });
  },

  get(projectId: number): InspectedElement | null {
    return inspectedElements.get(projectId) ?? null;
  },

  clear(projectId: number): void {
    inspectedElements.delete(projectId);
  },
};
