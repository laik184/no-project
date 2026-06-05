/**
 * server/tools/coding/registry/register-coding-tools.ts
 *
 * Registers ALL coding tools with the central tool registry.
 * Call once at application boot, before sealRegistry().
 * Idempotent — subsequent calls are no-ops.
 */

import { registerTool } from '../../../tools/registry/tool-registry.ts';

// ── Frontend ──────────────────────────────────────────────────────────────────
import { generateReactPageTool }      from '../frontend/generate-react-page.ts';
import { generateReactLayoutTool }    from '../frontend/generate-react-layout.ts';
import { generateReactHookTool }      from '../frontend/generate-react-hook.ts';
import { generateReactContextTool }   from '../frontend/generate-react-context.ts';
import { generateTailwindUITool }     from '../frontend/generate-tailwind-ui.ts';
import { generateReactRoutingTool }   from '../frontend/generate-react-routing.ts';
import { generateComponentTreeTool }  from '../frontend/generate-component-tree.ts';

// ── Backend ───────────────────────────────────────────────────────────────────
import { generateExpressRouteTool }      from '../backend/generate-express-route.ts';
import { generateControllerTool }        from '../backend/generate-controller.ts';
import { generateServiceTool }           from '../backend/generate-service.ts';
import { generateMiddlewareTool }        from '../backend/generate-middleware.ts';
import { generateModuleTool }            from '../backend/generate-module.ts';
import { generateErrorHandlerTool }      from '../backend/generate-error-handler.ts';
import { generateServerBootstrapTool }   from '../backend/generate-server-bootstrap.ts';

// ── API ───────────────────────────────────────────────────────────────────────
import { generateRestApiTool }          from '../api/generate-rest-api.ts';
import { generateRequestSchemaTool }    from '../api/generate-request-schema.ts';
import { generateResponseSchemaTool }   from '../api/generate-response-schema.ts';
import { generateApiValidationTool }    from '../api/generate-api-validation.ts';
import { generateApiHandlerTool }       from '../api/generate-api-handler.ts';
import { generateApiClientTool }        from '../api/generate-api-client.ts';

// ── Auth ──────────────────────────────────────────────────────────────────────
import { generateJwtAuthTool }          from '../auth/generate-jwt-auth.ts';
import { generateSessionAuthTool }      from '../auth/generate-session-auth.ts';
import { generateLoginFlowTool }        from '../auth/generate-login-flow.ts';
import { generateSignupFlowTool }       from '../auth/generate-signup-flow.ts';
import { generateRoleSystemTool }       from '../auth/generate-role-system.ts';
import { generateAuthMiddlewareTool }   from '../auth/generate-auth-middleware.ts';
import { generatePasswordHashingTool }  from '../auth/generate-password-hashing.ts';

// ── Database ──────────────────────────────────────────────────────────────────
import { generateSchemaTool }           from '../database/generate-schema.ts';
import { generateModelTool }            from '../database/generate-model.ts';
import { generateRelationTool }         from '../database/generate-relation.ts';
import { generateMigrationTool }        from '../database/generate-migration.ts';
import { generateSeedTool }             from '../database/generate-seed.ts';
import { generateRepositoryTool }       from '../database/generate-repository.ts';
import { generateDbConfigTool }         from '../database/generate-db-config.ts';

// ── Components ────────────────────────────────────────────────────────────────
import { generateFormTool }             from '../components/generate-form.ts';
import { generateTableTool }            from '../components/generate-table.ts';
import { generateModalTool }            from '../components/generate-modal.ts';
import { generateDashboardTool }        from '../components/generate-dashboard.ts';
import { generateNavbarTool }           from '../components/generate-navbar.ts';
import { generateSidebarTool }          from '../components/generate-sidebar.ts';
import { generateLoadingStateTool }     from '../components/generate-loading-state.ts';

// ── CRUD ──────────────────────────────────────────────────────────────────────
import { generateCrudModuleTool }       from '../crud/generate-crud-module.ts';
import { generateCrudApiTool }          from '../crud/generate-crud-api.ts';
import { generateCrudUITool }           from '../crud/generate-crud-ui.ts';
import { generateCrudSchemaTool }       from '../crud/generate-crud-schema.ts';
import { generateCrudTestsTool }        from '../crud/generate-crud-tests.ts';

// ── Generic (catch-all) ───────────────────────────────────────────────────────
import { generateGenericFileTool }      from '../generic/generate-generic-file.ts';

// ── Registration list ─────────────────────────────────────────────────────────

const ALL_CODING_TOOLS = [
  // Frontend (7)
  generateReactPageTool,
  generateReactLayoutTool,
  generateReactHookTool,
  generateReactContextTool,
  generateTailwindUITool,
  generateReactRoutingTool,
  generateComponentTreeTool,
  // Backend (7)
  generateExpressRouteTool,
  generateControllerTool,
  generateServiceTool,
  generateMiddlewareTool,
  generateModuleTool,
  generateErrorHandlerTool,
  generateServerBootstrapTool,
  // API (6)
  generateRestApiTool,
  generateRequestSchemaTool,
  generateResponseSchemaTool,
  generateApiValidationTool,
  generateApiHandlerTool,
  generateApiClientTool,
  // Auth (7)
  generateJwtAuthTool,
  generateSessionAuthTool,
  generateLoginFlowTool,
  generateSignupFlowTool,
  generateRoleSystemTool,
  generateAuthMiddlewareTool,
  generatePasswordHashingTool,
  // Database (7)
  generateSchemaTool,
  generateModelTool,
  generateRelationTool,
  generateMigrationTool,
  generateSeedTool,
  generateRepositoryTool,
  generateDbConfigTool,
  // Components (7)
  generateFormTool,
  generateTableTool,
  generateModalTool,
  generateDashboardTool,
  generateNavbarTool,
  generateSidebarTool,
  generateLoadingStateTool,
  // CRUD (5)
  generateCrudModuleTool,
  generateCrudApiTool,
  generateCrudUITool,
  generateCrudSchemaTool,
  generateCrudTestsTool,
  // Generic catch-all (1)
  generateGenericFileTool,
] as const;

let _registered = false;

/**
 * Register all coding tools.
 * Idempotent — safe to call multiple times (subsequent calls are no-ops).
 */
export function registerCodingTools(): void {
  if (_registered) return;
  for (const tool of ALL_CODING_TOOLS) {
    registerTool(tool as Parameters<typeof registerTool>[0], { force: false });
  }
  _registered = true;
  console.log(`[register-coding-tools] Registered ${ALL_CODING_TOOLS.length} coding tools`);
}

export const CODING_TOOL_COUNT = ALL_CODING_TOOLS.length;
export const CODING_TOOL_NAMES = ALL_CODING_TOOLS.map(t => t.name);
