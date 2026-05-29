export interface ProjectTemplate {
  id: string;
  name: string;
  description: string;
  category: TemplateCategory;
  tags: string[];
  language: string;
  framework?: string;
  thumbnailUrl?: string;
  repoUrl?: string;
  popularity: number;
  isFeatured: boolean;
  isOfficial: boolean;
  variables: TemplateVariable[];
  createdAt: Date;
  updatedAt: Date;
}

export type TemplateCategory =
  | "web"
  | "api"
  | "fullstack"
  | "mobile"
  | "cli"
  | "data"
  | "ml"
  | "game"
  | "discord"
  | "bot"
  | "starter";

export interface TemplateVariable {
  key: string;
  label: string;
  description?: string;
  type: "string" | "boolean" | "select";
  required: boolean;
  defaultValue?: string;
  options?: string[];       // for type "select"
  validation?: {
    pattern?: string;
    minLength?: number;
    maxLength?: number;
  };
}

export interface TemplateFile {
  templateId: string;
  path: string;
  content: string;         // supports {{variable}} substitution
  isBinary: boolean;
  permissions?: number;
}

export interface TemplateSearchParams {
  q?: string;
  category?: TemplateCategory;
  language?: string;
  framework?: string;
  featured?: boolean;
  official?: boolean;
  page?: number;
  limit?: number;
}

export interface TemplateInstantiateRequest {
  templateId: string;
  projectId: string;
  variables: Record<string, string>;
}
