import type { AppType } from '../types/planner.types.ts';
import type { FrontendPlan, GoalAnalysis } from '../types/planning.types.ts';

const PAGE_SETS: Record<AppType, string[]> = {
  crud:        ['Home', 'List', 'Detail', 'Create', 'Edit'],
  saas:        ['Landing', 'Dashboard', 'Settings', 'Billing', 'Profile'],
  ai_app:      ['Home', 'Chat', 'History', 'Settings'],
  ecommerce:   ['Home', 'Catalog', 'Product', 'Cart', 'Checkout', 'Orders'],
  dashboard:   ['Overview', 'Reports', 'Analytics', 'Settings'],
  auth_system: ['Login', 'Register', 'ForgotPassword', 'Profile'],
  backend_api: [],
};

const FEATURE_SETS: Record<AppType, string[]> = {
  crud:        ['data-table', 'form-validation', 'pagination'],
  saas:        ['sidebar-nav', 'plan-selector', 'usage-meter', 'team-management'],
  ai_app:      ['chat-interface', 'markdown-renderer', 'streaming', 'history-sidebar'],
  ecommerce:   ['product-grid', 'cart-drawer', 'checkout-flow', 'order-tracking'],
  dashboard:   ['chart-widgets', 'date-picker', 'export-csv', 'filter-panel'],
  auth_system: ['mfa-input', 'social-login', 'password-strength'],
  backend_api: [],
};

export function planFrontend(appType: AppType, analysis: GoalAnalysis): FrontendPlan {
  if (!analysis.hasFrontend) {
    return {
      framework: 'none',
      routing: 'none',
      stateManagement: 'none',
      uiLibrary: 'none',
      pages: [],
      features: [],
    };
  }

  const basePages    = PAGE_SETS[appType] ?? ['Home'];
  const baseFeatures = FEATURE_SETS[appType] ?? [];
  const extraFeatures: string[] = [];

  if (analysis.hasAuth)          extraFeatures.push('auth-guard', 'user-menu');
  if (analysis.hasRealtime)      extraFeatures.push('live-updates', 'connection-status');
  if (analysis.hasNotifications) extraFeatures.push('notification-bell', 'toast-system');
  if (analysis.hasFileUpload)    extraFeatures.push('file-dropzone', 'upload-progress');
  if (analysis.hasSearch)        extraFeatures.push('global-search', 'debounced-input');

  return {
    framework:       'React',
    routing:         'Wouter',
    stateManagement: 'TanStack Query',
    uiLibrary:       'shadcn/ui + Tailwind CSS',
    pages:           basePages,
    features:        [...new Set([...baseFeatures, ...extraFeatures])],
  };
}
