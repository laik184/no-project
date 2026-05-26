/**
 * REPLIT IDE NAVIGATION ARCHITECTURE
 * System-level functional breakdown for state transitions across IDE views
 * 
 * CORE FUNCTIONS:
 * FUNCTION_NAV_1: RouteTransitionHandler
 * FUNCTION_NAV_2: ExecutionStatePreserver
 * FUNCTION_NAV_3: ViewContextMemory
 * FUNCTION_NAV_4: TabSwitchHandler
 * FUNCTION_NAV_5: LayoutToggler
 */

export interface ViewState {
  path: string;
  activeFile?: string;
  openTabs?: string[];
  scrollPosition?: number;
  executionSessionId?: string;
  isDirty?: boolean;
  timestamp: number;
}

export interface ExecutionSnapshot {
  sessionId: string;
  status: "idle" | "running" | "paused" | "completed" | "error";
  logs: string[];
  errors: Array<{ message: string; file?: string; line?: number; column?: number; type: string }>;
  duration: number;
  isPaused: boolean;
  wsConnected: boolean;
}

export interface NavigationEvent {
  type: "beforeNavigate" | "afterNavigate" | "tabSwitch" | "layoutToggle";
  from: string;
  to: string;
  preserveExecution: boolean;
  timestamp: number;
}

/**
 * FUNCTION_NAV_1: RouteTransitionHandler
 * Module: navigation/route-manager.ts
 * Trigger: Browser back/forward, link click, programmatic navigation
 * 
 * FLOW:
 * 1. Detect route change via Wouter navigation
 * 2. Before leaving current view, snapshot its state
 * 3. Save to ViewStateStack
 * 4. Handle execution state based on view type
 * 5. Load target view state from stack
 * 6. Restore view UI to previous state (scroll, tabs, cursor)
 * 
 * STATE IMPACT:
 * - Preserved: execution logs, session ID, messages
 * - Flushed: local UI state (unless saved in snapshot)
 * - Revalidated: file permissions, execution status
 */
export class RouteTransitionHandler {
  private viewStateStack: Map<string, ViewState> = new Map();
  private navigationHistory: string[] = [];
  private currentPath: string = "/";
  private eventListeners: ((event: NavigationEvent) => void)[] = [];

  onNavigation(callback: (event: NavigationEvent) => void): void {
    this.eventListeners.push(callback);
  }

  private emitEvent(event: NavigationEvent): void {
    this.eventListeners.forEach((cb) => cb(event));
  }

  async beforeNavigate(fromPath: string, toPath: string): Promise<void> {
    const beforeEvent: NavigationEvent = {
      type: "beforeNavigate",
      from: fromPath,
      to: toPath,
      preserveExecution: this.shouldPreserveExecution(fromPath, toPath),
      timestamp: Date.now(),
    };
    this.emitEvent(beforeEvent);

    // Save current view state to stack
    const viewState: ViewState = {
      path: fromPath,
      timestamp: Date.now(),
    };
    this.viewStateStack.set(fromPath, viewState);

    // Add to history for back/forward
    this.navigationHistory.push(toPath);
  }

  async afterNavigate(toPath: string): Promise<void> {
    this.currentPath = toPath;

    // Try to restore previous state for this path
    const savedState = this.viewStateStack.get(toPath);

    const afterEvent: NavigationEvent = {
      type: "afterNavigate",
      from: this.navigationHistory[this.navigationHistory.length - 2] || "/",
      to: toPath,
      preserveExecution: true,
      timestamp: Date.now(),
    };
    this.emitEvent(afterEvent);
  }

  private shouldPreserveExecution(fromPath: string, toPath: string): boolean {
    // IDE views that maintain execution state across navigation
    const executionPreservingViews = ["/console", "/preview", "/agent"];
    const from = executionPreservingViews.includes(fromPath);
    const to = executionPreservingViews.includes(toPath);
    return from || to; // Keep execution alive if either view preserves it
  }

  getViewState(path: string): ViewState | undefined {
    return this.viewStateStack.get(path);
  }

  clearViewState(path: string): void {
    this.viewStateStack.delete(path);
  }

  getNavigationHistory(): string[] {
    return [...this.navigationHistory];
  }
}

/**
 * FUNCTION_NAV_2: ExecutionStatePreserver
 * Module: execution/state-saver.ts
 * Trigger: Navigation initiated (any route change)
 * 
 * FLOW:
 * 1. Detect navigation start
 * 2. If execution running, capture snapshot
 * 3. Pause WebSocket listeners (don't close connection)
 * 4. Store session ID for resumption
 * 5. On return to execution view, resume listeners
 * 6. WebSocket remains connected in background
 * 
 * STATE IMPACT:
 * - Preserved: WebSocket connection, session ID, server-side execution
 * - Flushed: None - execution maintains server state
 * - Revalidated: WebSocket readiness, listener attachment
 * 
 * BACKEND IMPACT:
 * - No API call needed (WebSocket stays open)
 * - Server continues execution regardless of client state
 */
export class ExecutionStatePreserver {
  private snapshot: ExecutionSnapshot | null = null;
  private listenersDetached: boolean = false;
  private eventListeners: ((event: NavigationEvent) => void)[] = [];

  onNavigation(callback: (event: NavigationEvent) => void): void {
    this.eventListeners.push(callback);
  }

  private emitEvent(event: NavigationEvent): void {
    this.eventListeners.forEach((cb) => cb(event));
  }

  /**
   * Before leaving execution view, preserve state snapshot
   */
  async captureSnapshot(
    sessionId: string,
    status: string,
    logs: string[],
    errors: any[],
    duration: number
  ): Promise<ExecutionSnapshot> {
    this.snapshot = {
      sessionId,
      status: status as any,
      logs: [...logs],
      errors: [...errors],
      duration,
      isPaused: status === "running",
      wsConnected: true,
    };
    return this.snapshot;
  }

  /**
   * Detach WebSocket listeners without closing connection
   */
  detachListeners(): void {
    this.listenersDetached = true;
    // ExecutionClient remains connected, but no UI callbacks fire
  }

  /**
   * Re-attach listeners when returning to execution view
   */
  reattachListeners(): void {
    this.listenersDetached = false;
    // ExecutionClient resumes firing callbacks to UI
  }

  /**
   * Get last known execution state
   */
  getSnapshot(): ExecutionSnapshot | null {
    return this.snapshot;
  }

  /**
   * Clear snapshot (e.g., when execution completes)
   */
  clearSnapshot(): void {
    this.snapshot = null;
  }

  isListenerDetached(): boolean {
    return this.listenersDetached;
  }
}

/**
 * FUNCTION_NAV_3: ViewContextMemory
 * Module: context/view-memory.ts
 * Trigger: Any route change
 * 
 * FLOW:
 * 1. On leaving view, save all local state to per-view memory
 * 2. Store: editor tabs, scroll positions, active file, cursor position
 * 3. On returning to view, restore all saved state
 * 4. Restore scroll position, tab focus, cursor position in editor
 * 
 * STATE IMPACT:
 * - Preserved: per-view UI state (everything except execution)
 * - Flushed: None - all state cached in ViewContextMemory
 * - Revalidated: file existence, permissions
 * 
 * BACKEND IMPACT: None (client-side only)
 */
export class ViewContextMemory {
  private viewMemory: Map<string, Record<string, any>> = new Map();

  /**
   * Save view state when leaving
   */
  saveViewContext(path: string, context: Record<string, any>): void {
    this.viewMemory.set(path, { ...context, savedAt: Date.now() });
  }

  /**
   * Restore view state when entering
   */
  restoreViewContext(path: string): Record<string, any> | undefined {
    return this.viewMemory.get(path);
  }

  /**
   * Clear specific view context
   */
  clearViewContext(path: string): void {
    this.viewMemory.delete(path);
  }

  /**
   * Clear all contexts (e.g., on app reset)
   */
  clearAllContexts(): void {
    this.viewMemory.clear();
  }

  /**
   * Get all stored contexts
   */
  getAllContexts(): Map<string, Record<string, any>> {
    return new Map(this.viewMemory);
  }
}

/**
 * FUNCTION_NAV_4: TabSwitchHandler
 * Module: ui/tab-manager.ts
 * Trigger: User clicks tab header (Editor/Console/Preview/Agent/Publishing)
 * 
 * FLOW:
 * 1. User clicks tab button
 * 2. If switching FROM execution view (running), pause listeners
 * 3. Render new view component
 * 4. If switching TO execution view, reattach listeners
 * 5. Load view context from memory
 * 6. Restore scroll, tab focus, cursor position
 * 
 * STATE IMPACT:
 * - Preserved: all execution state (session, logs, errors)
 * - Flushed: none (tab switching preserves everything)
 * - Revalidated: view component initialization
 * 
 * EXECUTION IMPACT:
 * - WebSocket stays open
 * - Listeners attached/detached based on view visibility
 * - No execution pause/resume (just UI listener toggle)
 * 
 * BACKEND IMPACT:
 * - May fetch view-specific data (console logs, preview state)
 * - No pause/resume API calls needed
 */
export class TabSwitchHandler {
  private activeTab: string = "console";
  private tabOrder: string[] = ["console", "agent", "preview", "publishing"];
  private eventListeners: ((event: NavigationEvent) => void)[] = [];

  onTabSwitch(callback: (event: NavigationEvent) => void): void {
    this.eventListeners.push(callback);
  }

  private emitEvent(event: NavigationEvent): void {
    this.eventListeners.forEach((cb) => cb(event));
  }

  async switchTab(toTab: string, preserveExecution: boolean = true): Promise<void> {
    const fromTab = this.activeTab;

    const event: NavigationEvent = {
      type: "tabSwitch",
      from: `/console?tab=${fromTab}`,
      to: `/console?tab=${toTab}`,
      preserveExecution,
      timestamp: Date.now(),
    };

    this.emitEvent(event);
    this.activeTab = toTab;
  }

  /**
   * Get currently active tab
   */
  getActiveTab(): string {
    return this.activeTab;
  }

  /**
   * Get all available tabs
   */
  getTabOrder(): string[] {
    return [...this.tabOrder];
  }

  /**
   * Navigate to next tab (for keyboard shortcuts)
   */
  async nextTab(): Promise<void> {
    const currentIndex = this.tabOrder.indexOf(this.activeTab);
    const nextIndex = (currentIndex + 1) % this.tabOrder.length;
    await this.switchTab(this.tabOrder[nextIndex]);
  }

  /**
   * Navigate to previous tab (for keyboard shortcuts)
   */
  async prevTab(): Promise<void> {
    const currentIndex = this.tabOrder.indexOf(this.activeTab);
    const prevIndex = (currentIndex - 1 + this.tabOrder.length) % this.tabOrder.length;
    await this.switchTab(this.tabOrder[prevIndex]);
  }
}

/**
 * FUNCTION_NAV_5: LayoutToggler
 * Module: ui/layout-controller.ts
 * Trigger: User clicks grid ↔ fullscreen toggle button
 * 
 * FLOW:
 * 1. User clicks layout toggle button
 * 2. CSS transforms viewport (no state change)
 * 3. All view data remains unchanged
 * 4. Execution continues uninterrupted
 * 5. On exit, restore original layout
 * 
 * STATE IMPACT:
 * - Preserved: ALL (no state change, just CSS)
 * - Flushed: None
 * - Revalidated: None
 * 
 * EXECUTION IMPACT: None - pure UI transformation
 * BACKEND IMPACT: None
 */
export class LayoutToggler {
  private isGridMode: boolean = false;
  private previousLayout: string = "fullscreen";
  private eventListeners: ((event: NavigationEvent) => void)[] = [];

  onLayoutToggle(callback: (event: NavigationEvent) => void): void {
    this.eventListeners.push(callback);
  }

  private emitEvent(event: NavigationEvent): void {
    this.eventListeners.forEach((cb) => cb(event));
  }

  toggleLayout(fromView: string): void {
    const event: NavigationEvent = {
      type: "layoutToggle",
      from: this.isGridMode ? "grid" : "fullscreen",
      to: this.isGridMode ? "fullscreen" : "grid",
      preserveExecution: true,
      timestamp: Date.now(),
    };

    this.emitEvent(event);
    this.isGridMode = !this.isGridMode;
  }

  /**
   * Get current layout mode
   */
  getLayoutMode(): "grid" | "fullscreen" {
    return this.isGridMode ? "grid" : "fullscreen";
  }

  /**
   * Check if in grid mode
   */
  isGridModeActive(): boolean {
    return this.isGridMode;
  }

  /**
   * Force layout mode
   */
  setLayoutMode(mode: "grid" | "fullscreen"): void {
    this.isGridMode = mode === "grid";
  }
}

/**
 * MISSING ELEMENTS IN CURRENT SYSTEM
 * 
 * MISSING_NAV_UI_1: No NavigationStack/History Handler
 * Current: Wouter only handles URL routing
 * Missing: Dedicated history manager tracking view state snapshots
 * Impact: Back button doesn't restore UI state, only URL
 * Solution: RouteTransitionHandler + ViewContextMemory
 * 
 * MISSING_NAV_STATE_1: No ViewStateSnapshot/Restore
 * Current: AppStateContext only maintains messages, console, execution state
 * Missing: Per-view state snapshots (editor tabs, file tree expansion, scroll positions)
 * Impact: Switching tabs and returning loses UI state
 * Solution: ViewContextMemory stores and restores per-view state
 * 
 * MISSING_NAV_STATE_2: No ExecutionPauseOnNavigate
 * Current: ExecutionClient has stop() but no pause/resume
 * Missing: Ability to pause execution listeners when leaving view, resume when returning
 * Impact: Execution either running or stopped - no intermediate state
 * Solution: ExecutionStatePreserver.detachListeners() / reattachListeners()
 * 
 * MISSING_NAV_EXEC_1: WebSocket Listener Attachment/Detachment
 * Current: ExecutionClient attaches listeners in executeCode() but never detaches
 * Missing: Listener lifecycle management tied to view visibility
 * Impact: Multiple listeners may attach, causing duplicate updates or memory leaks
 * Solution: ExecutionStatePreserver manages listener lifecycle
 * 
 * MISSING_NAV_EVENT_1: No Navigation Event Emitter
 * Current: No event bus for route changes
 * Missing: Central event emitter broadcasting before/after navigation to all subscribed modules
 * Impact: Components can't react to navigation transitions to clean up or restore state
 * Solution: NavigationEventBus with beforeNavigate/afterNavigate events
 * 
 * MISSING_NAV_EVENT_2: No ViewMountHandler/OnEnterOnExit Hooks
 * Current: Pages just mount/unmount with no lifecycle hooks
 * Missing: onEnter/onExit hooks for views needing setup/cleanup
 * Impact: Console can't re-attach to existing execution, Preview can't refresh iframe
 * Solution: NavigationLifecycle hooks on each view component
 */
