import { useEffect, useMemo, useState, type ElementType, type ReactNode } from "react";
import { AlertCircle, ArrowUpRight, Calendar, Check, CheckCircle2, ChevronRight, CircleDot, CloudCog, Copy, Database, ExternalLink, FileText, FolderOpen, GitBranch, Info, Lightbulb, Link as LinkIcon, Loader2, Lock, Mail, MessageSquare, Pencil, Plug, Plus, RefreshCw, Search, Send, ShieldCheck, Unplug, Users, Wifi, X } from "lucide-react";
import { SiSpotify, SiTodoist, SiYoutube, SiZendesk, SiFigma, SiBitbucket, SiGithub, SiGitlab } from "react-icons/si";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface Integration {
  id: string;
  name: string;
  icon: ElementType;
  type?: string;
  description: string;
  status?: "connected" | "available";
  isLogo?: boolean;
}

type ConnectionState = "connected" | "disconnected" | "connecting" | "syncing" | "error";
type IntegrationTab = "all" | "replit" | "connectors" | "connected";

const CONNECTIONS_STORAGE_KEY = "nura-x-integration-connections";

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
    icon: MessageSquare,
    description: "Send SMS messages and make voice calls using the Twilio API",
    status: "available",
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

function matchesIntegration(integration: Integration, query: string) {
  const normalized = query.trim().toLowerCase();
  return !normalized || `${integration.name} ${integration.description} ${integration.type ?? ""}`.toLowerCase().includes(normalized);
}

function stateLabel(state: ConnectionState) {
  return {
    connected: "Connected",
    disconnected: "Not connected",
    connecting: "Connecting",
    syncing: "Syncing",
    error: "Needs attention",
  }[state];
}

function stateClasses(state: ConnectionState) {
  return {
    connected: "bg-emerald-400/10 text-emerald-300 border-emerald-400/20",
    disconnected: "bg-white/5 text-muted-foreground border-white/10",
    connecting: "bg-blue-400/10 text-blue-300 border-blue-400/20",
    syncing: "bg-violet-400/10 text-violet-300 border-violet-400/20",
    error: "bg-red-400/10 text-red-300 border-red-400/20",
  }[state];
}

function getStoredConnections(): Record<string, ConnectionState> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(CONNECTIONS_STORAGE_KEY) ?? "{}") as Record<string, ConnectionState>;
  } catch {
    return {};
  }
}

export default function Integrations() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<IntegrationTab>("all");
  const [connections, setConnections] = useState<Record<string, ConnectionState>>(getStoredConnections);
  const [loading, setLoading] = useState(true);
  const [selectedIntegration, setSelectedIntegration] = useState<Integration | null>(null);
  const [learnOpen, setLearnOpen] = useState(false);
  const [requestOpen, setRequestOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [requestText, setRequestText] = useState("");
  const [feedbackText, setFeedbackText] = useState("");

  const allIntegrations = useMemo(() => [...connectors, ...mcpServers, ...gitProviders], []);
  const connectedCount = allIntegrations.filter((integration) => connections[integration.id] === "connected").length;
  const filteredConnectors = useMemo(() => connectors.filter((item) => matchesIntegration(item, searchQuery)), [searchQuery]);
  const filteredMcpServers = useMemo(() => mcpServers.filter((item) => matchesIntegration(item, searchQuery)), [searchQuery]);
  const filteredGitProviders = useMemo(() => gitProviders.filter((item) => matchesIntegration(item, searchQuery)), [searchQuery]);
  const filteredManaged = useMemo(() => replitManaged.filter((item) => matchesIntegration(item, searchQuery)), [searchQuery]);
  const filteredConnected = useMemo(() => allIntegrations.filter((item) => matchesIntegration(item, searchQuery) && connections[item.id] === "connected"), [allIntegrations, connections, searchQuery]);
  const hasResults = activeTab === "replit" ? filteredManaged.length > 0 : activeTab === "connected" ? filteredConnected.length > 0 : activeTab === "connectors" ? filteredConnectors.length + filteredMcpServers.length + filteredGitProviders.length > 0 : filteredManaged.length + filteredConnectors.length + filteredMcpServers.length + filteredGitProviders.length > 0;

  useEffect(() => {
    const timer = window.setTimeout(() => setLoading(false), 280);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    window.localStorage.setItem(CONNECTIONS_STORAGE_KEY, JSON.stringify(connections));
  }, [connections]);

  const connectIntegration = (integration: Integration) => {
    setConnections((current) => ({ ...current, [integration.id]: "connecting" }));
    window.setTimeout(() => {
      setConnections((current) => ({ ...current, [integration.id]: "connected" }));
      toast({ title: `${integration.name} connected`, description: "This connection is saved in your browser for this workspace." });
    }, 700);
  };

  const disconnectIntegration = (integration: Integration) => {
    setConnections((current) => ({ ...current, [integration.id]: "disconnected" }));
    toast({ title: `${integration.name} disconnected`, description: "You can reconnect it whenever you need it." });
  };

  const syncIntegration = (integration: Integration) => {
    setConnections((current) => ({ ...current, [integration.id]: "syncing" }));
    window.setTimeout(() => {
      setConnections((current) => ({ ...current, [integration.id]: "connected" }));
      toast({ title: `${integration.name} is up to date`, description: "The local connection state was refreshed." });
    }, 650);
  };

  const getState = (integration: Integration): ConnectionState => connections[integration.id] ?? "disconnected";

  const IntegrationStatus = ({ state }: { state: ConnectionState }) => (
    <Badge variant="outline" className={cn("gap-1.5 rounded-full text-[10px] font-medium", stateClasses(state))}>
      {state === "connecting" || state === "syncing" ? <Loader2 className="h-3 w-3 animate-spin" /> : state === "connected" ? <CheckCircle2 className="h-3 w-3" /> : state === "error" ? <AlertCircle className="h-3 w-3" /> : <CircleDot className="h-3 w-3" />}
      {stateLabel(state)}
    </Badge>
  );

  const IntegrationActions = ({ integration }: { integration: Integration }) => {
    const state = getState(integration);
    if (state === "connecting") return <Button size="sm" variant="secondary" disabled className="gap-2"><Loader2 className="h-3.5 w-3.5 animate-spin" />Connecting</Button>;
    if (state === "syncing") return <Button size="sm" variant="secondary" disabled className="gap-2"><Loader2 className="h-3.5 w-3.5 animate-spin" />Syncing</Button>;
    if (state === "connected") {
      return (
        <div className="flex items-center gap-1.5">
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => syncIntegration(integration)} aria-label={`Sync ${integration.name}`}><RefreshCw className="h-3.5 w-3.5" />Sync</Button>
          <Button size="sm" variant="ghost" className="gap-1.5 text-muted-foreground hover:text-red-300" onClick={() => disconnectIntegration(integration)} aria-label={`Disconnect ${integration.name}`}><Unplug className="h-3.5 w-3.5" /><span className="hidden sm:inline">Disconnect</span></Button>
        </div>
      );
    }
    return <Button size="sm" onClick={() => connectIntegration(integration)} className="gap-1.5" aria-label={`Connect ${integration.name}`}><Wifi className="h-3.5 w-3.5" />Connect</Button>;
  };

  const IntegrationRow = ({ integration }: { integration: Integration }) => {
    const Icon = integration.icon;
    const state = getState(integration);
    return (
      <Card className="border-white/8 bg-white/[0.018] p-3.5 transition-colors hover:border-white/15 hover:bg-white/[0.035] sm:p-4" data-testid={`integration-${integration.id}`}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/8", integration.isLogo ? "bg-white/5" : "bg-muted/70")}>
              <Icon className={cn(integration.isLogo ? "h-5 w-5" : "h-4.5 w-4.5", "text-foreground")} aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="truncate text-sm font-medium" data-testid={`integration-name-${integration.id}`}>{integration.name}</h3>
                <IntegrationStatus state={state} />
              </div>
              <p className="mt-1 line-clamp-2 text-xs text-muted-foreground sm:truncate">{integration.description}</p>
            </div>
          </div>
          <div className="shrink-0"><IntegrationActions integration={integration} /></div>
        </div>
        {state === "error" && <p className="mt-3 flex items-center gap-1.5 text-xs text-red-300"><AlertCircle className="h-3.5 w-3.5" /> We couldn't verify this connection. Try connecting again.</p>}
      </Card>
    );
  };

  const ManagedCard = ({ integration }: { integration: Integration }) => {
    const Icon = integration.icon;
    return (
      <Card className="border-white/8 bg-white/[0.018] p-3.5 transition-colors hover:border-white/15 hover:bg-white/[0.035]" data-testid={`integration-${integration.id}`}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/8 bg-muted/70"><Icon className="h-4.5 w-4.5" aria-hidden="true" /></div>
            <div className="min-w-0"><h3 className="truncate text-sm font-medium">{integration.name}</h3><p className="mt-0.5 text-xs text-muted-foreground">{integration.type}</p></div>
          </div>
          <Badge variant="outline" className="shrink-0 gap-1 rounded-full border-emerald-400/20 bg-emerald-400/10 text-[10px] text-emerald-300"><Check className="h-3 w-3" /> Ready</Badge>
        </div>
        <p className="mt-3 line-clamp-2 text-xs leading-5 text-muted-foreground">{integration.description}</p>
        <Button size="sm" variant="ghost" className="mt-2 h-8 gap-1 px-0 text-xs text-primary hover:bg-transparent hover:text-primary/80" onClick={() => { setSelectedIntegration(integration); setLearnOpen(true); }}>Learn more <ChevronRight className="h-3.5 w-3.5" /></Button>
      </Card>
    );
  };

  const Section = ({ icon: Icon, title, description, children, id }: { icon: ElementType; title: string; description: string; children: ReactNode; id?: string }) => (
    <section aria-labelledby={id} className="space-y-3">
      <div className="flex items-start gap-2.5">
        <Icon className="mt-0.5 h-4.5 w-4.5 shrink-0 text-muted-foreground" aria-hidden="true" />
        <div><h2 id={id} className="text-base font-semibold">{title}</h2><p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p></div>
      </div>
      {children}
    </section>
  );

  const NoResults = () => (
    <div className="flex min-h-[220px] flex-col items-center justify-center rounded-xl border border-dashed border-white/12 bg-white/[0.012] px-6 text-center">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 text-muted-foreground"><Search className="h-4 w-4" /></div>
      <h2 className="text-sm font-medium">{activeTab === "connected" ? "No connected integrations" : "No integrations found"}</h2>
      <p className="mt-1 max-w-sm text-xs leading-5 text-muted-foreground">{activeTab === "connected" ? "Connect an integration to see it here." : `No results match “${searchQuery}”. Try another search term.`}</p>
      <Button size="sm" variant="outline" className="mt-4" onClick={() => { setSearchQuery(""); setActiveTab("all"); }}>Clear filters</Button>
    </div>
  );

  const SkeletonList = () => <div className="space-y-3">{[1, 2, 3].map((item) => <div key={item} className="h-[74px] animate-pulse rounded-xl border border-white/8 bg-white/[0.035]" />)}</div>;

  const submitRequest = () => {
    if (!requestText.trim()) return;
    toast({ title: "Request submitted", description: "Thanks — we’ll review this integration request." });
    setRequestText("");
    setRequestOpen(false);
  };

  const submitFeedback = () => {
    if (!feedbackText.trim()) return;
    toast({ title: "Feedback sent", description: "Your MCP feedback has been recorded." });
    setFeedbackText("");
    setFeedbackOpen(false);
  };

  const renderConnectorSections = (includeAll = false) => (
    <div className="space-y-8">
      {(includeAll || activeTab === "connectors") && (
        <Section icon={Plug} title="Connectors" id="heading-connectors" description="Sign in once and use these first-party integrations across your apps.">
          {filteredConnectors.length > 0 ? <div className="space-y-3">{filteredConnectors.map((item) => <IntegrationRow key={item.id} integration={item} />)}</div> : <p className="rounded-xl border border-dashed border-white/10 p-5 text-center text-xs text-muted-foreground">No connectors match your search.</p>}
        </Section>
      )}
      {(includeAll || activeTab === "connectors") && (
        <Section icon={Plug} title="MCP Servers for Replit Agent" id="heading-mcp-servers" description="Give Agent external context and tools by connecting an MCP server.">
          {filteredMcpServers.map((item) => <IntegrationRow key={item.id} integration={item} />)}
          <Card className="border-white/8 bg-muted/30 p-4">
            <div className="flex items-start gap-3"><Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" /><div className="flex-1"><h3 className="text-sm font-medium">Want support for more MCPs?</h3><p className="mt-1 text-xs text-muted-foreground">Tell us which external tools would make Agent more useful for you.</p><Button size="sm" variant="outline" className="mt-3 gap-1.5" onClick={() => setFeedbackOpen(true)}><Send className="h-3.5 w-3.5" />Share feedback</Button></div></div>
          </Card>
        </Section>
      )}
      {(includeAll || activeTab === "connectors") && (
        <Section icon={GitBranch} title="Git providers" id="heading-git-providers" description="Connect version control tools for authenticating to git remotes in your apps.">
          <div className="space-y-3">{filteredGitProviders.map((item) => <IntegrationRow key={item.id} integration={item} />)}</div>
        </Section>
      )}
    </div>
  );

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col bg-background">
      <header className="flex shrink-0 items-center justify-between border-b border-white/8 px-5 py-3.5 sm:px-7">
        <div className="flex items-center gap-3"><div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary"><Plug className="h-4 w-4" /></div><div><h1 className="text-lg font-semibold" data-testid="text-integrations-title">Integrations</h1><p className="hidden text-xs text-muted-foreground sm:block">Connect the tools your apps rely on</p></div></div>
        <Button data-testid="button-request-integration" variant="outline" className="h-9 gap-2 text-xs" onClick={() => setRequestOpen(true)}><Plus className="h-3.5 w-3.5" /><span className="hidden sm:inline">Request an integration</span><span className="sm:hidden">Request</span></Button>
      </header>

      <div className="min-h-0 flex-1 overflow-auto">
        <div className="mx-auto w-full max-w-[1440px] px-5 py-5 sm:px-7">
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as IntegrationTab)} className="space-y-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <TabsList className="h-9 w-fit bg-white/[0.045]" data-testid="tabs-integrations">
                <TabsTrigger className="h-7 px-2.5 text-xs sm:px-3" value="all" data-testid="tab-all">All</TabsTrigger>
                <TabsTrigger className="h-7 px-2.5 text-xs sm:px-3" value="replit" data-testid="tab-replit">Replit managed</TabsTrigger>
                <TabsTrigger className="h-7 px-2.5 text-xs sm:px-3" value="connectors" data-testid="tab-connectors">Connectors</TabsTrigger>
                <TabsTrigger className="h-7 gap-1.5 px-2.5 text-xs sm:px-3" value="connected" data-testid="tab-connected">Connected {connectedCount > 0 && <span className="rounded-full bg-emerald-400/15 px-1.5 text-[10px] text-emerald-300">{connectedCount}</span>}</TabsTrigger>
              </TabsList>
              <div className="relative w-full lg:max-w-sm">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input placeholder="Search integrations..." value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} className="h-9 border-white/10 bg-white/[0.025] pl-9 pr-9 text-xs" data-testid="input-search-integrations" aria-label="Search integrations" />
                {searchQuery && <button className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" onClick={() => setSearchQuery("")} aria-label="Clear integration search"><X className="h-3.5 w-3.5" /></button>}
              </div>
            </div>

            {loading ? <SkeletonList /> : !hasResults ? <NoResults /> : (
              <>
                <TabsContent value="all" className="mt-0 space-y-7">
                  {filteredManaged.length > 0 && <Section icon={Database} title="Replit managed" id="heading-replit-managed" description="Built-in services that work automatically with every app."><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">{filteredManaged.map((item) => <ManagedCard key={item.id} integration={item} />)}</div></Section>}
                  {renderConnectorSections(true)}
                </TabsContent>
                <TabsContent value="replit" className="mt-0"><Section icon={Database} title="Replit managed" id="heading-replit-managed" description="Built-in services that work automatically with every app."><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">{filteredManaged.map((item) => <ManagedCard key={item.id} integration={item} />)}</div></Section></TabsContent>
                <TabsContent value="connectors" className="mt-0">{renderConnectorSections()}</TabsContent>
                <TabsContent value="connected" className="mt-0"><Section icon={CheckCircle2} title="Connected integrations" description="Manage the connections currently available in this workspace."><div className="space-y-3">{filteredConnected.map((item) => <IntegrationRow key={item.id} integration={item} />)}</div></Section></TabsContent>
              </>
            )}
          </Tabs>
        </div>
      </div>

      <Dialog open={learnOpen} onOpenChange={setLearnOpen}>
        <DialogContent className="border-white/10 bg-[hsl(222,28%,9%)] sm:max-w-[480px]">
          <DialogHeader><DialogTitle className="flex items-center gap-2">{selectedIntegration && <selectedIntegration.icon className="h-5 w-5" />} {selectedIntegration?.name}</DialogTitle><DialogDescription>{selectedIntegration?.type} is managed by Replit and available to your app without separate credentials.</DialogDescription></DialogHeader>
          <div className="space-y-3 rounded-xl border border-white/8 bg-white/[0.025] p-4 text-sm"><div className="flex gap-3"><CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-300" /><p className="text-muted-foreground">Agent can configure this service when your app needs it.</p></div><div className="flex gap-3"><Info className="mt-0.5 h-4 w-4 text-primary" /><p className="text-muted-foreground">No external sign-in is required for Replit managed services.</p></div></div>
          <DialogFooter><Button onClick={() => setLearnOpen(false)}>Done</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={requestOpen} onOpenChange={setRequestOpen}>
        <DialogContent className="border-white/10 bg-[hsl(222,28%,9%)] sm:max-w-[480px]">
          <DialogHeader><DialogTitle>Request an integration</DialogTitle><DialogDescription>Tell us which tool you want to use and what you need it to do.</DialogDescription></DialogHeader>
          <Textarea value={requestText} onChange={(event) => setRequestText(event.target.value)} placeholder="Example: Airtable, for reading and updating records..." className="min-h-28 resize-none" autoFocus />
          <DialogFooter><Button variant="outline" onClick={() => setRequestOpen(false)}>Cancel</Button><Button onClick={submitRequest} disabled={!requestText.trim()}><Send className="mr-2 h-4 w-4" />Submit request</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={feedbackOpen} onOpenChange={setFeedbackOpen}>
        <DialogContent className="border-white/10 bg-[hsl(222,28%,9%)] sm:max-w-[480px]">
          <DialogHeader><DialogTitle>Share MCP feedback</DialogTitle><DialogDescription>Which MCP server would make your workflow better?</DialogDescription></DialogHeader>
          <Textarea value={feedbackText} onChange={(event) => setFeedbackText(event.target.value)} placeholder="Share a tool, use case, or workflow..." className="min-h-28 resize-none" autoFocus />
          <DialogFooter><Button variant="outline" onClick={() => setFeedbackOpen(false)}>Cancel</Button><Button onClick={submitFeedback} disabled={!feedbackText.trim()}><Send className="mr-2 h-4 w-4" />Send feedback</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
