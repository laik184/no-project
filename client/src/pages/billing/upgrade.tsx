import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleHelp,
  Clock3,
  Code2,
  Crown,
  Database,
  Gauge,
  Globe2,
  Loader2,
  Lock,
  MessageSquare,
  Rocket,
  ShieldCheck,
  Sparkles,
  Star,
  Users,
  X,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

type BillingCycle = "monthly" | "yearly";
type PlanId = "core" | "pro";

type Plan = {
  id: PlanId;
  name: string;
  eyebrow: string;
  monthly: number;
  yearly: number;
  description: string;
  icon: typeof Zap;
  accent: string;
  features: string[];
  limits: string[];
};

const plans: Plan[] = [
  {
    id: "core",
    name: "Core",
    eyebrow: "For focused builders",
    monthly: 20,
    yearly: 16,
    description: "More Agent power and room to build without interruptions.",
    icon: Zap,
    accent: "from-indigo-500/20 to-violet-500/15",
    features: ["Extended Agent usage", "Private projects", "Custom domains", "Priority workspace support"],
    limits: ["Up to 5 collaborators", "25 GB storage", "Advanced deployment controls"],
  },
  {
    id: "pro",
    name: "Pro",
    eyebrow: "For serious product teams",
    monthly: 40,
    yearly: 32,
    description: "Higher limits and collaboration tools for shipping at speed.",
    icon: Crown,
    accent: "from-violet-500/25 to-fuchsia-500/15",
    features: ["Everything in Core", "Unlimited private projects", "Team workspaces", "Faster Agent responses"],
    limits: ["Unlimited collaborators", "100 GB storage", "Advanced usage insights"],
  },
];

const featureRows = [
  { label: "AI Agent access", icon: Sparkles, free: "Included", core: "Extended", pro: "Priority" },
  { label: "Private projects", icon: Lock, free: "1", core: "Unlimited", pro: "Unlimited" },
  { label: "Custom domains", icon: Globe2, free: false, core: true, pro: true },
  { label: "Collaborators", icon: Users, free: "1", core: "5", pro: "Unlimited" },
  { label: "Storage", icon: Database, free: "500 MB", core: "25 GB", pro: "100 GB" },
  { label: "Usage insights", icon: Gauge, free: "Basic", core: "Advanced", pro: "Advanced" },
];

function formatPrice(plan: Plan, cycle: BillingCycle) {
  return cycle === "yearly" ? plan.yearly : plan.monthly;
}

function PlanFeature({ children }: { children: string }) {
  return (
    <li className="flex items-start gap-2 text-xs leading-5 text-muted-foreground">
      <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-300" />
      <span>{children}</span>
    </li>
  );
}

function ComparisonValue({ value }: { value: string | boolean }) {
  if (value === true) return <Check className="mx-auto h-4 w-4 text-emerald-300" aria-label="Included" />;
  if (value === false) return <X className="mx-auto h-4 w-4 text-muted-foreground/40" aria-label="Not included" />;
  return <span className="text-xs text-muted-foreground">{value}</span>;
}

export default function Upgrade() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [cycle, setCycle] = useState<BillingCycle>("yearly");
  const [selectedPlan, setSelectedPlan] = useState<PlanId>("core");
  const [compareOpen, setCompareOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(true);

  const selected = useMemo(() => plans.find((plan) => plan.id === selectedPlan) ?? plans[0], [selectedPlan]);
  const currentPlan = typeof window !== "undefined" ? window.localStorage.getItem("nura-x-plan") : null;

  useEffect(() => {
    const timer = window.setTimeout(() => setLoading(false), 260);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (currentPlan === selectedPlan) setSuccess(true);
  }, [currentPlan, selectedPlan]);

  const choosePlan = (id: PlanId) => {
    setSelectedPlan(id);
    setSuccess(false);
  };

  const confirmUpgrade = () => {
    setProcessing(true);
    window.setTimeout(() => {
      window.localStorage.setItem("nura-x-plan", selected.id);
      window.localStorage.setItem("nura-x-billing-cycle", cycle);
      setProcessing(false);
      setConfirmOpen(false);
      setSuccess(true);
      toast({ title: `${selected.name} plan selected`, description: "Your workspace plan has been updated in this browser." });
    }, 850);
  };

  const returnPath = () => {
    const source = new URLSearchParams(window.location.search).get("source");
    return source === "usage" ? "/usage" : source === "settings" ? "/" : "/apps";
  };

  if (loading) {
    return (
      <main className="flex min-h-0 flex-1 flex-col overflow-hidden bg-background">
        <div className="mx-auto w-full max-w-6xl animate-pulse px-5 py-8 sm:px-8">
          <div className="h-4 w-24 rounded bg-white/8" />
          <div className="mt-8 h-10 w-72 rounded bg-white/8" />
          <div className="mt-3 h-4 w-full max-w-lg rounded bg-white/6" />
          <div className="mt-10 grid gap-4 md:grid-cols-2">
            <div className="h-80 rounded-2xl border border-white/8 bg-white/[0.03]" />
            <div className="h-80 rounded-2xl border border-white/8 bg-white/[0.03]" />
          </div>
        </div>
      </main>
    );
  }

  if (success) {
    return (
      <main className="flex min-h-0 flex-1 flex-col overflow-auto bg-background">
        <div className="mx-auto flex min-h-full w-full max-w-3xl items-center justify-center px-5 py-12 sm:px-8">
          <section className="w-full rounded-3xl border border-emerald-400/20 bg-gradient-to-br from-emerald-400/[0.08] to-white/[0.02] p-7 text-center shadow-2xl sm:p-12">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-400/15 text-emerald-300">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <p className="mt-6 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">Plan active</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground">You’re ready to build more.</h1>
            <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-muted-foreground">
              {selected.name} is now active for this workspace. Your new limits are available immediately.
            </p>
            <div className="mx-auto mt-7 grid max-w-md grid-cols-2 gap-3 text-left sm:grid-cols-3">
              <div className="rounded-xl border border-white/8 bg-white/[0.035] p-3"><Rocket className="h-4 w-4 text-primary" /><p className="mt-2 text-xs text-muted-foreground">Plan</p><p className="text-sm font-semibold">{selected.name}</p></div>
              <div className="rounded-xl border border-white/8 bg-white/[0.035] p-3"><Clock3 className="h-4 w-4 text-primary" /><p className="mt-2 text-xs text-muted-foreground">Billing</p><p className="text-sm font-semibold capitalize">{cycle}</p></div>
              <div className="col-span-2 rounded-xl border border-white/8 bg-white/[0.035] p-3 sm:col-span-1"><ShieldCheck className="h-4 w-4 text-primary" /><p className="mt-2 text-xs text-muted-foreground">Status</p><p className="text-sm font-semibold text-emerald-300">Active</p></div>
            </div>
            <div className="mt-8 flex flex-col justify-center gap-2 sm:flex-row">
              <Button variant="outline" onClick={() => setSuccess(false)}>Compare plans</Button>
              <Button onClick={() => navigate(returnPath())} className="gap-2">Continue building <ArrowRight className="h-4 w-4" /></Button>
            </div>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-0 flex-1 flex-col overflow-auto bg-background">
      <div className="mx-auto w-full max-w-6xl px-5 py-5 sm:px-8 sm:py-7">
        <button onClick={() => navigate(returnPath())} className="inline-flex items-center gap-2 text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" aria-label="Go back">
          <ArrowLeft className="h-3.5 w-3.5" /> Back
        </button>

        <div className="mt-8 flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
          <div>
            <div className="mb-3 flex items-center gap-2 text-xs font-medium text-primary"><Sparkles className="h-3.5 w-3.5" /> Upgrade your workspace</div>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">Build without limits.</h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">Choose the plan that fits how you build. Change your plan whenever your work grows.</p>
          </div>
          <div className="flex w-fit items-center gap-1 rounded-xl border border-white/10 bg-white/[0.035] p-1" role="group" aria-label="Billing cycle">
            <button onClick={() => setCycle("monthly")} aria-pressed={cycle === "monthly"} className={cn("rounded-lg px-3 py-2 text-xs font-medium transition-colors", cycle === "monthly" ? "bg-white/10 text-foreground" : "text-muted-foreground hover:text-foreground")}>Monthly</button>
            <button onClick={() => setCycle("yearly")} aria-pressed={cycle === "yearly"} className={cn("flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-colors", cycle === "yearly" ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground")}>Yearly <span className="rounded-full bg-emerald-400/10 px-1.5 py-0.5 text-[9px] text-emerald-300">Save 20%</span></button>
          </div>
        </div>

        <div className="mt-8 grid gap-4 lg:grid-cols-3">
          <article className="flex flex-col rounded-2xl border border-white/8 bg-white/[0.02] p-5">
            <div className="flex items-start justify-between"><div><p className="text-xs font-medium text-muted-foreground">Current plan</p><h2 className="mt-2 text-xl font-semibold">Starter</h2></div><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/7 text-muted-foreground"><Star className="h-4 w-4" /></div></div>
            <p className="mt-3 text-xs leading-5 text-muted-foreground">A simple starting point for exploring the workspace.</p>
            <div className="mt-6 space-y-2.5">{["Basic Agent access", "1 private project", "500 MB storage"].map((item) => <div key={item} className="flex items-center gap-2 text-xs text-muted-foreground"><Check className="h-3.5 w-3.5 text-muted-foreground" />{item}</div>)}</div>
            <div className="mt-auto pt-7"><div className="flex items-center gap-2 text-xs text-muted-foreground"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-300" />Current plan</div></div>
          </article>

          {plans.map((plan) => {
            const PlanIcon = plan.icon;
            const isSelected = selectedPlan === plan.id;
            return (
              <article key={plan.id} className={cn("relative flex flex-col rounded-2xl border p-5 transition-all", isSelected ? "border-primary/50 bg-gradient-to-br " + plan.accent + " shadow-[0_0_28px_hsl(var(--primary)/.1)]" : "border-white/8 bg-white/[0.02] hover:border-white/15")}>
                {plan.id === "core" && <span className="absolute -top-3 left-5 rounded-full border border-primary/25 bg-[hsl(222,30%,8%)] px-2.5 py-1 text-[10px] font-semibold text-primary">Most popular</span>}
                <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-medium text-muted-foreground">{plan.eyebrow}</p><h2 className="mt-2 flex items-center gap-2 text-xl font-semibold">{plan.name} <PlanIcon className="h-4 w-4 text-primary" /></h2></div><button onClick={() => choosePlan(plan.id)} className={cn("flex h-5 w-5 items-center justify-center rounded-full border transition-colors", isSelected ? "border-primary bg-primary text-primary-foreground" : "border-white/20 text-transparent hover:border-primary/60")} aria-label={`Select ${plan.name} plan`} aria-pressed={isSelected}><Check className="h-3 w-3" /></button></div>
                <p className="mt-3 min-h-10 text-xs leading-5 text-muted-foreground">{plan.description}</p>
                <div className="mt-4 flex items-end gap-1"><span className="text-3xl font-semibold">${formatPrice(plan, cycle)}</span><span className="pb-1 text-xs text-muted-foreground">/ month</span></div>
                {cycle === "yearly" && <p className="mt-1 text-[10px] text-emerald-300">Billed annually · 20% savings</p>}
                <div className="mt-5 space-y-2">{plan.features.map((feature) => <PlanFeature key={feature}>{feature}</PlanFeature>)}</div>
                <Button variant={isSelected ? "default" : "outline"} className="mt-6 w-full gap-2" onClick={() => { choosePlan(plan.id); setConfirmOpen(true); }}><span>{isSelected ? "Choose this plan" : `Select ${plan.name}`}</span><ArrowRight className="h-3.5 w-3.5" /></Button>
              </article>
            );
          })}
        </div>

        <div className="mt-5 flex flex-col items-start justify-between gap-3 rounded-xl border border-white/8 bg-white/[0.018] px-4 py-3 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><CircleHelp className="h-4 w-4 text-primary" /> Need to compare limits and features side by side?</div>
          <Button variant="ghost" className="h-8 gap-1 px-0 text-xs text-primary hover:bg-transparent hover:text-primary/80" onClick={() => setCompareOpen(true)}>View full comparison <ChevronDown className="h-3.5 w-3.5" /></Button>
        </div>

        <div className="mt-8 grid gap-3 sm:grid-cols-3">
          <div className="flex gap-3 rounded-xl border border-white/7 bg-white/[0.018] p-3.5"><MessageSquare className="h-4 w-4 shrink-0 text-primary" /><div><p className="text-xs font-medium">Agent-ready</p><p className="mt-1 text-[11px] leading-4 text-muted-foreground">More room for Agent to help you ship.</p></div></div>
          <div className="flex gap-3 rounded-xl border border-white/7 bg-white/[0.018] p-3.5"><ShieldCheck className="h-4 w-4 shrink-0 text-primary" /><div><p className="text-xs font-medium">Secure by default</p><p className="mt-1 text-[11px] leading-4 text-muted-foreground">Your projects stay private and yours.</p></div></div>
          <div className="flex gap-3 rounded-xl border border-white/7 bg-white/[0.018] p-3.5"><Code2 className="h-4 w-4 shrink-0 text-primary" /><div><p className="text-xs font-medium">Built for shipping</p><p className="mt-1 text-[11px] leading-4 text-muted-foreground">Tools that keep your workflow moving.</p></div></div>
        </div>
      </div>

      <Dialog open={compareOpen} onOpenChange={setCompareOpen}>
        <DialogContent className="max-w-3xl border-white/10 bg-[hsl(222,28%,9%)]">
          <DialogHeader><DialogTitle>Compare plans</DialogTitle><DialogDescription>See what’s included across your workspace plans.</DialogDescription></DialogHeader>
          <div className="max-h-[60vh] overflow-auto rounded-xl border border-white/8">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="border-b border-white/8 bg-white/[0.025]"><tr><th className="px-4 py-3 text-xs font-medium text-muted-foreground">Feature</th><th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground">Starter</th><th className="px-4 py-3 text-center text-xs font-medium text-primary">Core</th><th className="px-4 py-3 text-center text-xs font-medium text-violet-300">Pro</th></tr></thead>
              <tbody>{featureRows.map((row) => { const Icon = row.icon; return <tr key={row.label} className="border-b border-white/7 last:border-0"><td className="flex items-center gap-2 px-4 py-3 text-xs text-foreground"><Icon className="h-3.5 w-3.5 text-muted-foreground" />{row.label}</td><td className="px-4 py-3 text-center"><ComparisonValue value={row.free} /></td><td className="px-4 py-3 text-center"><ComparisonValue value={row.core} /></td><td className="px-4 py-3 text-center"><ComparisonValue value={row.pro} /></td></tr>; })}</tbody>
            </table>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setCompareOpen(false)}>Close</Button><Button onClick={() => { setCompareOpen(false); setConfirmOpen(true); }}>Continue with {selected.name}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="border-white/10 bg-[hsl(222,28%,9%)] sm:max-w-[480px]">
          <DialogHeader><DialogTitle>Confirm your plan</DialogTitle><DialogDescription>Review your selection before applying it to this workspace.</DialogDescription></DialogHeader>
          <div className="rounded-xl border border-primary/20 bg-primary/[0.06] p-4"><div className="flex items-start justify-between"><div><p className="text-xs text-muted-foreground">Selected plan</p><p className="mt-1 text-lg font-semibold">{selected.name}</p></div><div className="text-right"><p className="text-2xl font-semibold">${formatPrice(selected, cycle)}</p><p className="text-[10px] capitalize text-muted-foreground">{cycle} billing</p></div></div><div className="mt-4 border-t border-white/8 pt-3 text-xs text-muted-foreground"><p>{selected.description}</p><p className="mt-2">You can change this selection from the upgrade page at any time.</p></div></div>
          <div className="flex items-start gap-2 text-xs text-muted-foreground"><Lock className="mt-0.5 h-3.5 w-3.5 text-emerald-300" /> This frontend flow stores your selection locally. No payment is processed.</div>
          <DialogFooter><Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={processing}>Go back</Button><Button onClick={confirmUpgrade} disabled={processing} className="gap-2">{processing && <Loader2 className="h-4 w-4 animate-spin" />}{processing ? "Activating..." : "Confirm plan"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}