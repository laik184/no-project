import GoalRunner from './components/agent/GoalRunner';
import Timeline from './components/layout/Timeline';
import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { SidebarDrawerProvider } from "@/components/panels/sidebar-drawer-context";
import { SidebarDrawer } from "@/components/panels/sidebar-drawer";
import { AppStateProvider } from "@/context/app-state-context";
import { RealtimeProvider } from "@/realtime/realtime-provider";
import { LifecycleProvider } from "@/context/lifecycle-context";
import { ImportModalProvider } from "@/context/import-modal-context";
import { ImportModal } from "@/components/import/import-modal";
import Home from "@/pages/core/home";
import Workspace from "@/pages/core/workspace";
import Apps from "@/pages/projects/apps";
import CreateProject from "@/pages/projects/create-project";
import ImportPage from "@/pages/import/import";
import GitHubImport from "@/pages/import/github-import";
import FigmaImport from "@/pages/import/figma-import";
import LovableImport from "@/pages/import/lovable-import";
import BoltImport from "@/pages/import/bolt-import";
import VercelImport from "@/pages/import/vercel-import";
import Base44Import from "@/pages/import/base44-import";
import Usage from "@/pages/analytics/usage";
import Upgrade from "@/pages/billing/upgrade";
import Integrations from "@/pages/settings/integrations";
import Publishing from "@/pages/publishing/publishing";
import PublishedApps from "@/pages/publishing/published-apps";
import Console from "@/pages/devtools/console";
import DeveloperFrameworks from "@/pages/devtools/developer-frameworks";
import Preview from "@/pages/preview";
import NotFound from "@/pages/utility/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/apps" component={Apps} />
      <Route path="/published" component={PublishedApps} />
      <Route path="/integrations" component={Integrations} />
      <Route path="/usage" component={Usage} />
      <Route path="/upgrade" component={Upgrade} />
      <Route path="/frameworks" component={DeveloperFrameworks} />
      <Route path="/import" component={ImportPage} />
      <Route path="/import/github" component={GitHubImport} />
      <Route path="/import/figma" component={FigmaImport} />
      <Route path="/import/lovable" component={LovableImport} />
      <Route path="/import/bolt" component={BoltImport} />
      <Route path="/import/vercel" component={VercelImport} />
      <Route path="/import/base44" component={Base44Import} />
      <Route path="/create" component={CreateProject} />
      <Route path="/publishing" component={Publishing} />
      <Route path="/console" component={Console} />
      <Route path="/preview" component={Preview} />
      <Route path="/workspace" component={Workspace} />
      <Route path="/workspace/:id" component={Workspace} />
      <Route component={NotFound} />
    </Switch>
  );
}

function AppShell() {
  const [location] = useLocation();
  const isWorkspace = location === "/workspace" || location.startsWith("/workspace/") || location.startsWith("/workspace?");

  if (isWorkspace) {
    return (
      <div className="flex h-screen w-full overflow-hidden min-h-0">
        <Router />
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full overflow-hidden min-h-0">
      <AppSidebar />
      <div className="flex-1 flex flex-col overflow-hidden min-w-0 min-h-0">
        <GoalRunner />
        <Timeline />
        <Router />
      </div>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <RealtimeProvider>
      <LifecycleProvider>
      <AppStateProvider>
        <ImportModalProvider>
          <SidebarDrawerProvider>
            <TooltipProvider>
              <AppShell />
              <SidebarDrawer />
              <ImportModal />
              <Toaster />
            </TooltipProvider>
          </SidebarDrawerProvider>
        </ImportModalProvider>
      </AppStateProvider>
      </LifecycleProvider>
      </RealtimeProvider>
    </QueryClientProvider>
  );
}

export default App;
