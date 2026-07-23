import { useState } from "react";
import {
  CreditCard, Bell, RefreshCw, FileText, Rocket, Terminal,
  Smartphone, Shield, Key, LogOut, UserX, AlertTriangle, Plus,
} from "lucide-react";
import { Row, Toggle, Select, UsageBar, SectionTitle, ActionBtn } from "./settings-primitives";
import { useLocation } from "wouter";

interface SharedSectionProps {
  sq: string;
  wrap: <T>(fn: (v: T) => void, label?: string) => (v: T) => void;
  showToast: (msg: string) => void;
}

interface BillingSectionProps extends SharedSectionProps {
  billingEmail: string; setBillingEmail: (v: string) => void;
  autoRenew: boolean; setAutoRenew: (v: boolean) => void;
}
export function BillingSection({ sq, wrap, showToast, billingEmail, setBillingEmail, autoRenew, setAutoRenew }: BillingSectionProps) {
  const [, navigate] = useLocation();
  if (sq && !"billing plan upgrade payment invoice subscription".includes(sq)) return null;
  return (
    <section className="mt-4">
      <SectionTitle>Billing &amp; Payments</SectionTitle>
      <div className="mx-0 p-4 rounded-xl mb-2" style={{ background: "linear-gradient(135deg, rgba(124,141,255,0.1) 0%, rgba(167,139,250,0.08) 100%)", border: "1px solid rgba(124,141,255,0.2)" }}>
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-[11px] text-muted-foreground/60 mb-0.5">Current Plan</div>
            <div className="flex items-center gap-2">
              <span className="text-[15px] font-bold text-foreground">Free</span>
              <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full" style={{ background: "rgba(124,141,255,0.15)", color: "#a78bfa", border: "1px solid rgba(124,141,255,0.25)" }}>ACTIVE</span>
            </div>
          </div>
          <ActionBtn variant="primary" onClick={() => navigate("/upgrade?source=settings")}>
            <Rocket style={{ width: 11, height: 11 }} />
            Upgrade Plan
          </ActionBtn>
        </div>
        <div className="flex flex-col gap-2.5 mb-3">
          <UsageBar label="API Usage" used={42000} total={100000} color="#7c8dff" />
          <UsageBar label="Storage" used={1.8} total={5} color="#34d399" />
          <UsageBar label="Compute (hrs)" used={12} total={50} color="#fb923c" />
        </div>
        <div className="flex gap-2 flex-wrap">
          <ActionBtn onClick={() => showToast("Opening subscription portal…")}><RefreshCw style={{ width: 10, height: 10 }} />Manage Subscription</ActionBtn>
          <ActionBtn onClick={() => showToast("Fetching invoices…")}><FileText style={{ width: 10, height: 10 }} />View Invoices</ActionBtn>
        </div>
      </div>
      {(!sq || "email".includes(sq)) && (
        <Row icon={Bell} iconColor="#60a5fa" label="Billing Email" sub="Receive invoice copies">
          <input value={billingEmail} onChange={(e) => { setBillingEmail(e.target.value); showToast("Saved"); }} className="text-[11px] px-2.5 py-1.5 rounded-lg bg-transparent focus:outline-none" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(203,213,225,0.85)", width: 160 }} />
        </Row>
      )}
      {(!sq || "auto renew".includes(sq)) && (
        <Row icon={RefreshCw} iconColor="#34d399" label="Auto-Renew" sub="Renew subscription automatically">
          <Toggle value={autoRenew} onChange={wrap(setAutoRenew)} />
        </Row>
      )}
      <div className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-white/[0.025] transition-colors -mx-1">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "#60a5fa15", border: "1px solid #60a5fa25" }}>
          <CreditCard style={{ width: 13, height: 13, color: "#60a5fa" }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[12.5px] font-medium text-foreground/90">Payment Method</div>
          <div className="text-[10.5px] text-muted-foreground/60 mt-0.5">No cards saved</div>
        </div>
        <ActionBtn onClick={() => showToast("Add card — coming soon!")}><Plus style={{ width: 10, height: 10 }} />Add Card</ActionBtn>
      </div>
    </section>
  );
}

interface SecuritySectionProps extends SharedSectionProps {
  twoFA: boolean; setTwoFA: (v: boolean) => void;
}
export function SecuritySection({ sq, wrap, showToast, twoFA, setTwoFA }: SecuritySectionProps) {
  if (sq && !"security 2fa session token".includes(sq)) return null;
  return (
    <section className="mt-4">
      <SectionTitle>Security</SectionTitle>
      {(!sq || "2fa two factor".includes(sq)) && <Row icon={Smartphone} iconColor="#f472b6" label="Two-Factor Auth (2FA)" sub="Extra login security"><Toggle value={twoFA} onChange={wrap(setTwoFA)} /></Row>}
      {(!sq || "session".includes(sq)) && (
        <Row icon={Shield} iconColor="#fb923c" label="Active Sessions" sub="View and revoke access">
          <ActionBtn onClick={() => showToast("Opening sessions…")}><Shield style={{ width: 10, height: 10 }} />Manage</ActionBtn>
        </Row>
      )}
      {(!sq || "token api".includes(sq)) && (
        <Row icon={Key} iconColor="#a78bfa" label="API Token" sub="Programmatic access">
          <ActionBtn onClick={() => showToast("Token generated!")}><RefreshCw style={{ width: 10, height: 10 }} />Generate</ActionBtn>
        </Row>
      )}
    </section>
  );
}

interface DeploymentSectionProps extends SharedSectionProps {
  autoDeploy: boolean; setAutoDeploy: (v: boolean) => void;
  environment: string; setEnvironment: (v: string) => void;
}
export function DeploymentSection({ sq, wrap, showToast, autoDeploy, setAutoDeploy, environment, setEnvironment }: DeploymentSectionProps) {
  if (sq && !"deployment deploy environment publish".includes(sq)) return null;
  return (
    <section className="mt-4">
      <SectionTitle>Deployment</SectionTitle>
      {(!sq || "auto deploy".includes(sq)) && <Row icon={Rocket} iconColor="#60a5fa" label="Auto Deploy" sub="Deploy on every push"><Toggle value={autoDeploy} onChange={wrap(setAutoDeploy)} /></Row>}
      {(!sq || "environment".includes(sq)) && (
        <Row icon={Terminal} iconColor="#4ade80" label="Environment" sub="Target deployment env">
          <Select value={environment} onChange={wrap(setEnvironment)} options={[
            { label: "Production", value: "production" }, { label: "Staging", value: "staging" }, { label: "Development", value: "development" },
          ]} />
        </Row>
      )}
      {(!sq || "publish".includes(sq)) && (
        <Row icon={Rocket} iconColor="#a78bfa" label="Publish App" sub="Deploy current version">
          <ActionBtn variant="primary" onClick={() => showToast("Deploying…")}><Rocket style={{ width: 10, height: 10 }} />Publish 🚀</ActionBtn>
        </Row>
      )}
    </section>
  );
}

interface AccountSectionProps extends SharedSectionProps {}
export function AccountSection({ sq, showToast }: AccountSectionProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteInput, setDeleteInput] = useState("");
  if (sq && !"account logout log out sign out delete".includes(sq)) return null;
  return (
    <section className="mt-4 mb-2">
      <SectionTitle>Account</SectionTitle>
      {(!sq || "logout log out sign out".includes(sq)) && (
        <Row icon={LogOut} iconColor="#60a5fa" label="Log Out" sub="Sign out of your account">
          <ActionBtn onClick={() => showToast("Logging out…")}><LogOut style={{ width: 10, height: 10 }} />Log Out</ActionBtn>
        </Row>
      )}
      {(!sq || "delete account".includes(sq)) && !showDeleteConfirm && (
        <Row icon={UserX} iconColor="#f87171" label="Delete Account" sub="Permanently remove your account" danger>
          <ActionBtn variant="danger" onClick={() => { setShowDeleteConfirm(true); setDeleteInput(""); }}>
            <UserX style={{ width: 10, height: 10 }} />Delete
          </ActionBtn>
        </Row>
      )}
      {showDeleteConfirm && (!sq || "delete account".includes(sq)) && (
        <div className="mx-0 mt-1 mb-2 p-4 rounded-xl" style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.22)" }} data-testid="delete-account-confirm">
          <div className="flex items-start gap-2.5 mb-3">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.2)" }}>
              <AlertTriangle style={{ width: 13, height: 13, color: "#f87171" }} />
            </div>
            <div>
              <p className="text-[12.5px] font-semibold text-red-400 mb-1">Delete your account?</p>
              <p className="text-[11px] leading-relaxed" style={{ color: "rgba(148,163,184,0.6)" }}>
                This will permanently delete all your projects, data, and settings. This action <strong className="text-red-400/80">cannot</strong> be undone.
              </p>
            </div>
          </div>
          <p className="text-[10.5px] text-muted-foreground/50 mb-1.5">Type <span className="font-mono text-red-400/80 font-semibold">DELETE</span> to confirm</p>
          <input value={deleteInput} onChange={(e) => setDeleteInput(e.target.value)} placeholder="Type DELETE…" autoFocus className="w-full text-[12px] px-3 py-2 rounded-lg mb-3 focus:outline-none" style={{ background: "rgba(255,255,255,0.04)", border: deleteInput === "DELETE" ? "1px solid rgba(239,68,68,0.5)" : "1px solid rgba(255,255,255,0.08)", color: "rgba(226,232,240,0.9)" }} data-testid="input-delete-confirm" />
          <div className="flex gap-2">
            <button onClick={() => { setShowDeleteConfirm(false); setDeleteInput(""); }} className="flex-1 py-2 rounded-lg text-[11px] font-medium transition-colors hover:bg-white/5" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(148,163,184,0.7)" }}>Cancel</button>
            <button disabled={deleteInput !== "DELETE"} onClick={() => { showToast("Account deleted"); setShowDeleteConfirm(false); }} className="flex-1 py-2 rounded-lg text-[11px] font-semibold transition-all" style={{ background: deleteInput === "DELETE" ? "rgba(239,68,68,0.85)" : "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)", color: deleteInput === "DELETE" ? "#fff" : "rgba(248,113,113,0.35)", cursor: deleteInput !== "DELETE" ? "not-allowed" : "pointer", boxShadow: deleteInput === "DELETE" ? "0 0 12px rgba(239,68,68,0.35)" : "none" }} data-testid="button-confirm-delete">
              <UserX style={{ width: 11, height: 11, display: "inline", marginRight: 4 }} />Confirm Delete
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
