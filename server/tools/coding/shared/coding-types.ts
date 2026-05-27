/**
 * server/tools/coding/shared/coding-types.ts
 *
 * All input/output type contracts for the coding tool layer.
 * Tools GENERATE code as strings — they never write files or run commands.
 */

// ── Generation strategy ───────────────────────────────────────────────────────

export type GenerationStrategy = 'template' | 'llm';

// ── Core output ───────────────────────────────────────────────────────────────

export interface GenerationResult {
  files:             Record<string, string>;
  summary:           string;
  strategy:          GenerationStrategy;
  validationPassed:  boolean;
  warnings:          string[];
}

// ── Frontend inputs ───────────────────────────────────────────────────────────

export interface ReactPageInput {
  name:      string;
  content?:  string;
  strategy?: GenerationStrategy;
}

export interface ReactLayoutInput {
  name:       string;
  slots?:     string[];
  strategy?:  GenerationStrategy;
}

export interface ReactHookInput {
  name:        string;
  returnType?: string;
  body?:       string;
  strategy?:   GenerationStrategy;
}

export interface ReactContextInput {
  name:         string;
  stateFields?: string[];
  strategy?:    GenerationStrategy;
}

export interface TailwindUIInput {
  name:        string;
  variant?:    'card' | 'button' | 'input' | 'badge' | 'alert';
  strategy?:   GenerationStrategy;
}

export interface ReactRoutingInput {
  routes:    Array<{ path: string; component: string }>;
  strategy?: GenerationStrategy;
}

export interface ComponentTreeInput {
  root:      string;
  children?: string[];
  strategy?: GenerationStrategy;
}

// ── Backend inputs ────────────────────────────────────────────────────────────

export interface ExpressRouteInput {
  name:         string;
  prefix:       string;
  middlewares?: string[];
  strategy?:    GenerationStrategy;
}

export interface ControllerInput {
  resource:  string;
  fields?:   string[];
  strategy?: GenerationStrategy;
}

export interface ServiceInput {
  resource:  string;
  fields?:   string[];
  strategy?: GenerationStrategy;
}

export interface MiddlewareInput {
  name:      string;
  logic?:    string;
  strategy?: GenerationStrategy;
}

export interface ModuleInput {
  name:      string;
  exports?:  string[];
  strategy?: GenerationStrategy;
}

export interface ErrorHandlerInput {
  logErrors?: boolean;
  strategy?:  GenerationStrategy;
}

export interface ServerBootstrapInput {
  port?:     number;
  routes?:   Array<{ prefix: string; module: string }>;
  strategy?: GenerationStrategy;
}

// ── API inputs ────────────────────────────────────────────────────────────────

export interface RestApiInput {
  resource:  string;
  fields:    string[];
  strategy?: GenerationStrategy;
}

export interface RequestSchemaInput {
  name:      string;
  fields:    Array<{ name: string; type: string; required?: boolean }>;
  strategy?: GenerationStrategy;
}

export interface ResponseSchemaInput {
  name:      string;
  fields:    Array<{ name: string; type: string }>;
  strategy?: GenerationStrategy;
}

export interface ApiValidationInput {
  resource:  string;
  fields:    string[];
  strategy?: GenerationStrategy;
}

export interface ApiHandlerInput {
  resource:  string;
  method:    'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  fields?:   string[];
  strategy?: GenerationStrategy;
}

export interface ApiClientInput {
  resource:  string;
  baseUrl?:  string;
  strategy?: GenerationStrategy;
}

// ── Auth inputs ───────────────────────────────────────────────────────────────

export interface JwtAuthInput {
  userFields?: string[];
  strategy?:   GenerationStrategy;
}

export interface SessionAuthInput {
  userFields?: string[];
  strategy?:   GenerationStrategy;
}

export interface LoginFlowInput {
  userFields?: string[];
  strategy?:   GenerationStrategy;
}

export interface SignupFlowInput {
  userFields?: string[];
  strategy?:   GenerationStrategy;
}

export interface RoleSystemInput {
  roles:     string[];
  strategy?: GenerationStrategy;
}

export interface AuthMiddlewareInput {
  strategy_auth?: 'jwt' | 'session';
  strategy?:      GenerationStrategy;
}

export interface PasswordHashingInput {
  algorithm?: 'bcrypt' | 'argon2' | 'scrypt';
  strategy?:  GenerationStrategy;
}

// ── Database inputs ───────────────────────────────────────────────────────────

export interface SchemaInput {
  table:     string;
  fields:    Array<{ name: string; type: string; nullable?: boolean }>;
  strategy?: GenerationStrategy;
}

export interface ModelInput {
  name:      string;
  fields:    Array<{ name: string; type: string }>;
  strategy?: GenerationStrategy;
}

export interface RelationInput {
  from:      string;
  to:        string;
  type:      'one-to-many' | 'many-to-many' | 'one-to-one';
  strategy?: GenerationStrategy;
}

export interface MigrationInput {
  name:      string;
  up:        string;
  down?:     string;
  strategy?: GenerationStrategy;
}

export interface SeedInput {
  table:     string;
  count?:    number;
  fields?:   string[];
  strategy?: GenerationStrategy;
}

export interface RepositoryInput {
  resource:  string;
  fields?:   string[];
  strategy?: GenerationStrategy;
}

export interface DbConfigInput {
  dialect?: 'postgres' | 'mysql' | 'sqlite';
  strategy?: GenerationStrategy;
}

// ── Component inputs ──────────────────────────────────────────────────────────

export interface FormInput {
  name:      string;
  fields:    Array<{ name: string; type: string; label?: string; required?: boolean }>;
  strategy?: GenerationStrategy;
}

export interface TableInput {
  name:      string;
  columns:   Array<{ key: string; header: string }>;
  strategy?: GenerationStrategy;
}

export interface ModalInput {
  name:      string;
  content?:  string;
  strategy?: GenerationStrategy;
}

export interface DashboardInput {
  name:      string;
  widgets?:  string[];
  strategy?: GenerationStrategy;
}

export interface NavbarInput {
  links?:    Array<{ label: string; href: string }>;
  strategy?: GenerationStrategy;
}

export interface SidebarInput {
  items?:    Array<{ label: string; icon?: string; href: string }>;
  strategy?: GenerationStrategy;
}

export interface LoadingStateInput {
  name?:     string;
  variant?:  'spinner' | 'skeleton' | 'pulse';
  strategy?: GenerationStrategy;
}

// ── CRUD inputs ───────────────────────────────────────────────────────────────

export interface CrudModuleInput {
  resource:  string;
  fields:    string[];
  strategy?: GenerationStrategy;
}

export interface CrudApiInput {
  resource:  string;
  fields:    string[];
  strategy?: GenerationStrategy;
}

export interface CrudUiInput {
  resource:  string;
  fields:    string[];
  strategy?: GenerationStrategy;
}

export interface CrudSchemaInput {
  resource:  string;
  fields:    Array<{ name: string; type: string }>;
  strategy?: GenerationStrategy;
}

export interface CrudTestsInput {
  resource:  string;
  fields?:   string[];
  strategy?: GenerationStrategy;
}
