import { useState } from "react";
import { Search, Plus, Database, Lock, Link as LinkIcon, FolderOpen, Mail, FileText, Calendar, MessageSquare, CloudCog, ShieldCheck, Plug, CheckCircle2, Lightbulb, GitBranch } from "lucide-react";
import { SiSpotify, SiTodoist, SiTwilio, SiYoutube, SiZendesk, SiFigma, SiBitbucket, SiGithub, SiGitlab } from "react-icons/si";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

interface Integration {
  id: string;
  name: string;
  icon: any;
  type?: string;
  description: string;
  status?: "connected" | "available";
  isLogo?: boolean;
}

const replitManaged: Integration[] = [
  {
    id: "replit-database",
    name: "Replit Database",
    icon: Database,
    type: "PostgreSQL",
    description: "These are built-in integrations that work automatically. Create an app and your agent can start using these right away.",
  },
  {
    id: "replit-app-storage",
    name: "Replit App Storage",
    icon: FolderOpen,
    type: "Object Storage",
    description: "These are built-in integrations that work automatically. Create an app and your agent can start using these right away.",
  },
  {
    id: "replit-auth",
    name: "Replit Auth",
    icon: Lock,
    type: "Authentication",
    description: "These are built-in integrations that work automatically. Create an app and your agent can start using these right away.",
  },
  {
    id: "replit-domains",
    name: "Replit Domains",
    icon: LinkIcon,
    type: "Domains",
    description: "These are built-in integrations that work automatically. Create an app and your agent can start using these right away.",
  },
];

const connectors: Integration[] = [
  {
    id: "agentmail",
    name: "AgentMail",
    icon: Mail,
    description: "Send and manage emails using the AgentMail API",
    status: "available",
  },
  {
    id: "asana",
    name: "Asana",
    icon: ShieldCheck,
    description: "Read tasks and projects from Asana workspaces",
    status: "available",
  },
  {
    id: "box",
    name: "Box",
    icon: FolderOpen,
    description: "Access Box files and folders from Replit",
    status: "available",
  },
  {
    id: "confluence",
    name: "Confluence",
    icon: FileText,
    description: "Read pages and groups, create and edit content in Confluence spaces",
    status: "available",
  },
  {
    id: "discord",
    name: "Discord",
    icon: MessageSquare,
    description: "Access Discord guild information and user profiles",
    status: "available",
  },
  {
    id: "dropbox",
    name: "Dropbox",
    icon: CloudCog,
    description: "Access Dropbox files, content, and metadata",
    status: "available",
  },
  {
    id: "gmail",
    name: "Gmail",
    icon: Mail,
    description: "Send, receive, and manage Gmail messages",
    status: "available",
  },
  {
    id: "google-calendar",
    name: "Google Calendar",
    icon: Calendar,
    description: "Access and manage Google Calendar events and settings",
    status: "available",
  },
  {
    id: "google-docs",
    name: "Google Docs",
    icon: FileText,
    description: "Create, read, and edit Google Docs",
    status: "available",
  },
  {
    id: "google-drive",
    name: "Google Drive",
    icon: FolderOpen,
    description: "Access and manage Google Drive files and folders",
    status: "available",
  },
  {
    id: "google-sheets",
    name: "Google Sheets",
    icon: FileText,
    description: "Read and write data in Google Sheets",
    status: "available",
  },
  {
    id: "hubspot",
    name: "HubSpot",
    icon: ShieldCheck,
    description: "Access HubSpot CRM objects, contacts, and insights from Replit",
    status: "available",
  },
  {
    id: "linear",
    name: "Linear",
    icon: Plug,
    description: "Create and manage Linear issues, comments, and metadata",
    status: "available",
  },
  {
    id: "notion",
    name: "Notion",
    icon: FileText,
    description: "Read and write to Notion workspaces and pages",
    status: "available",
  },
  {
    id: "outlook",
    name: "Outlook",
    icon: Mail,
    description: "Read, receive emails, manage Outlook calendar events",
    status: "available",
  },
  {
    id: "resend",
    name: "Resend",
    icon: Mail,
    description: "Send transactional emails using the Resend API",
    status: "available",
  },
  {
    id: "sendgrid",
    name: "SendGrid",
    icon: Mail,
    description: "Send transactional emails using the SendGrid API",
    status: "available",
  },
  {
    id: "sharepoint",
    name: "SharePoint",
    icon: FolderOpen,
    description: "Read, write, and manage SharePoint sites and documents",
    status: "available",
  },
  {
    id: "spotify",
    name: "Spotify",
    icon: SiSpotify,
    description: "Access and manage Spotify playlists and libraries",
    status: "available",
    isLogo: true,
  },
  {
    id: "todoist",
    name: "Todoist",
    icon: SiTodoist,
    description: "Read and write to your Todoist tasks and projects",
    status: "available",
    isLogo: true,
  },
  {
    id: "twilio",
    name: "Twilio",
    icon: SiTwilio,
    description: "Send SMS messages and make voice calls using the Twilio API",
    status: "available",
    isLogo: true,
  },
  {
    id: "youtube",
    name: "YouTube",
    icon: SiYoutube,
    description: "Upload and manage YouTube videos, channels, and analytics",
    status: "available",
    isLogo: true,
  },
  {
    id: "zendesk",
    name: "Zendesk",
    icon: SiZendesk,
    description: "Access Zendesk users and support tickets from Replit",
    status: "available",
    isLogo: true,
  },
];

const mcpServers: Integration[] = [
  {
    id: "figma-mcp",
    name: "Figma MCP",
    icon: SiFigma,
    description: "Allow Replit Agent to view and rapidly build your designs from Figma",
    status: "available",
    isLogo: true,
  },
];

const gitProviders: Integration[] = [
  {
    id: "bitbucket",
    name: "Bitbucket",
    icon: SiBitbucket,
    description: "Sync code to Bitbucket repositories from your Replit apps",
    status: "available",
    isLogo: true,
  },
  {
    id: "github",
    name: "GitHub",
    icon: SiGithub,
    description: "Sync code to GitHub repositories from your Replit apps",
    status: "available",
    isLogo: true,
  },
  {
    id: "gitlab",
    name: "GitLab",
    icon: SiGitlab,
    description: "Sync code to GitLab projects from your Replit apps",
    status: "available",
    isLogo: true,
  },
];

export default function Integrations() {
  const [searchQuery, setSearchQuery] = useState("");

  const allIntegrations = [...connectors, ...mcpServers, ...gitProviders];
  const filteredConnectors = connectors.filter(
    (connector) =>
      connector.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      connector.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredMcpServers = mcpServers.filter(
    (server) =>
      server.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      server.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredGitProviders = gitProviders.filter(
    (provider) =>
      provider.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      provider.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredAll = allIntegrations.filter(
    (integration) =>
      integration.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      integration.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const IntegrationRow = ({ integration }: { integration: Integration }) => {
    const Icon = integration.icon;
    return (
      <Card className="p-4" data-testid={`integration-${integration.id}`}>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className={`shrink-0 ${integration.isLogo ? '' : 'p-2 rounded-md bg-muted'}`}>
              <Icon className={`${integration.isLogo ? 'h-6 w-6' : 'h-5 w-5'}`} />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-medium truncate" data-testid={`integration-name-${integration.id}`}>
                {integration.name}
              </h3>
              <p className="text-sm text-muted-foreground truncate">{integration.description}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Badge variant="secondary" className="text-xs">
              Connection status
            </Badge>
            <Button size="sm" data-testid={`button-signin-${integration.id}`}>
              Sign in
            </Button>
          </div>
        </div>
      </Card>
    );
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-background">
      <header className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold" data-testid="text-integrations-title">
            Integrations
          </h1>
        </div>
        <Button data-testid="button-request-integration" variant="outline" className="gap-2">
          <Plus className="h-4 w-4" />
          Request an integration
        </Button>
      </header>

      <div className="flex-1 p-6 overflow-auto">
        <Tabs defaultValue="all" className="space-y-6">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <TabsList data-testid="tabs-integrations">
              <TabsTrigger value="all" data-testid="tab-all">All</TabsTrigger>
              <TabsTrigger value="replit" data-testid="tab-replit">Replit managed</TabsTrigger>
              <TabsTrigger value="connectors" data-testid="tab-connectors">Connectors</TabsTrigger>
            </TabsList>
            
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search integrations"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
                data-testid="input-search-integrations"
              />
            </div>
          </div>

          <TabsContent value="all" className="space-y-8">
            <div>
              <h2 className="text-lg font-semibold mb-4" data-testid="heading-replit-managed">
                Replit managed
              </h2>
              <p className="text-sm text-muted-foreground mb-4">
                These are built-in integrations that work automatically. Create an app and your agent can start using these right away.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {replitManaged.map((integration) => {
                  const Icon = integration.icon;
                  return (
                    <Card key={integration.id} className="p-4" data-testid={`integration-${integration.id}`}>
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-md bg-muted">
                            <Icon className="h-5 w-5" />
                          </div>
                          <div>
                            <h3 className="font-medium" data-testid={`integration-name-${integration.id}`}>
                              {integration.name}
                            </h3>
                            <p className="text-xs text-muted-foreground">{integration.type}</p>
                          </div>
                        </div>
                        <Button size="sm" variant="secondary" data-testid={`button-learn-${integration.id}`}>
                          Learn more
                        </Button>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>

            {(searchQuery === "" || filteredConnectors.length > 0) && (
              <div>
                <h2 className="text-lg font-semibold mb-4" data-testid="heading-connectors">
                  Connectors
                </h2>
                <p className="text-sm text-muted-foreground mb-4">
                  These are first-party integrations Replit supports. Sign in once and build with them across your apps.
                </p>
                <div className="space-y-3">
                  {filteredConnectors.map((connector) => (
                    <IntegrationRow key={connector.id} integration={connector} />
                  ))}
                </div>
              </div>
            )}

            {(searchQuery === "" || filteredMcpServers.length > 0) && (
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <Plug className="h-5 w-5" />
                  <h2 className="text-lg font-semibold" data-testid="heading-mcp-servers">
                    MCP Servers for Replit Agent
                  </h2>
                  <Badge variant="secondary" className="text-xs">Beta</Badge>
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  Provide external context and tools to Replit Agent by connecting to{" "}
                  <a href="#" className="text-primary hover:underline">external MCP servers</a>.
                </p>
                <div className="space-y-3">
                  {filteredMcpServers.map((server) => (
                    <IntegrationRow key={server.id} integration={server} />
                  ))}
                </div>
                <Card className="p-4 mt-4 bg-muted/50">
                  <div className="flex items-start gap-3">
                    <Lightbulb className="h-5 w-5 mt-0.5 shrink-0" />
                    <div className="flex-1">
                      <h3 className="font-medium mb-1">Want support for more MCPs?</h3>
                      <p className="text-sm text-muted-foreground mb-3">
                        Tell us what MCP servers you'd like to use in Replit
                      </p>
                      <Button size="sm" variant="outline" data-testid="button-share-feedback">
                        Share feedback
                      </Button>
                    </div>
                  </div>
                </Card>
              </div>
            )}

            {(searchQuery === "" || filteredGitProviders.length > 0) && (
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <GitBranch className="h-5 w-5" />
                  <h2 className="text-lg font-semibold" data-testid="heading-git-providers">
                    Git Providers
                  </h2>
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  Connect your version control tools to use for authenticating to git remotes in your apps. Not accessible to Replit Agent.
                </p>
                <div className="space-y-3">
                  {filteredGitProviders.map((provider) => (
                    <IntegrationRow key={provider.id} integration={provider} />
                  ))}
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="replit" className="space-y-4">
            <p className="text-sm text-muted-foreground">
              These are built-in integrations that work automatically. Create an app and your agent can start using these right away.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {replitManaged.map((integration) => {
                const Icon = integration.icon;
                return (
                  <Card key={integration.id} className="p-4" data-testid={`integration-${integration.id}`}>
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-md bg-muted">
                          <Icon className="h-5 w-5" />
                        </div>
                        <div>
                          <h3 className="font-medium" data-testid={`integration-name-${integration.id}`}>
                            {integration.name}
                          </h3>
                          <p className="text-xs text-muted-foreground">{integration.type}</p>
                        </div>
                      </div>
                      <Button size="sm" variant="secondary" data-testid={`button-learn-${integration.id}`}>
                        Learn more
                      </Button>
                    </div>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          <TabsContent value="connectors" className="space-y-8">
            <div>
              <p className="text-sm text-muted-foreground mb-4">
                These are first-party integrations Replit supports. Sign in once and build with them across your apps.
              </p>
              <div className="space-y-3">
                {filteredConnectors.map((connector) => (
                  <IntegrationRow key={connector.id} integration={connector} />
                ))}
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2 mb-4">
                <Plug className="h-5 w-5" />
                <h2 className="text-lg font-semibold" data-testid="heading-mcp-servers">
                  MCP Servers for Replit Agent
                </h2>
                <Badge variant="secondary" className="text-xs">Beta</Badge>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                Provide external context and tools to Replit Agent by connecting to{" "}
                <a href="#" className="text-primary hover:underline">external MCP servers</a>.
              </p>
              <div className="space-y-3">
                {filteredMcpServers.map((server) => (
                  <IntegrationRow key={server.id} integration={server} />
                ))}
              </div>
              <Card className="p-4 mt-4 bg-muted/50">
                <div className="flex items-start gap-3">
                  <Lightbulb className="h-5 w-5 mt-0.5 shrink-0" />
                  <div className="flex-1">
                    <h3 className="font-medium mb-1">Want support for more MCPs?</h3>
                    <p className="text-sm text-muted-foreground mb-3">
                      Tell us what MCP servers you'd like to use in Replit
                    </p>
                    <Button size="sm" variant="outline" data-testid="button-share-feedback">
                      Share feedback
                    </Button>
                  </div>
                </div>
              </Card>
            </div>

            <div>
              <div className="flex items-center gap-2 mb-4">
                <GitBranch className="h-5 w-5" />
                <h2 className="text-lg font-semibold" data-testid="heading-git-providers">
                  Git Providers
                </h2>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                Connect your version control tools to use for authenticating to git remotes in your apps. Not accessible to Replit Agent.
              </p>
              <div className="space-y-3">
                {filteredGitProviders.map((provider) => (
                  <IntegrationRow key={provider.id} integration={provider} />
                ))}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
