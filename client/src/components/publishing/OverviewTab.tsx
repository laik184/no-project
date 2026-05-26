import { useState } from "react";
import {
  Globe,
  RefreshCw,
  Settings,
  Shield,
  Copy,
  Check,
  ExternalLink,
  XCircle,
} from "lucide-react";
import { DeployStatus, MOCK_DOMAIN, STATUS_CONFIG, StatusDot, Row } from "./types";

export function OverviewTab({
  onPublish,
  isDeploying,
  onSettings,
  onSecurity,
}: {
  onPublish: () => void;
  isDeploying: boolean;
  onSettings: () => void;
  onSecurity: () => void;
}) {
  const [status] = useState<DeployStatus>("failed");
  const [copied, setCopied] = useState(false);

  const copyDomain = () => {
    navigator.clipboard.writeText(`https://${MOCK_DOMAIN}`).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const cfg = STATUS_CONFIG[status];

  return (
    <div className="space-y-5">
      {/* Action buttons */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={onPublish}
          disabled={isDeploying}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-semibold transition-all duration-150"
          style={{
            background: "linear-gradient(135deg,#7c8dff,#a78bfa)",
            color: "#fff",
            cursor: isDeploying ? "not-allowed" : "pointer",
            opacity: isDeploying ? 0.55 : 1,
          }}
          onMouseEnter={(e) => { if (!isDeploying) (e.currentTarget as HTMLElement).style.opacity = "0.88"; }}
          onMouseLeave={(e) => { if (!isDeploying) (e.currentTarget as HTMLElement).style.opacity = "1"; }}
          data-testid="button-republish"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Republish
        </button>

        <button
          onClick={onSettings}
          className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-[13px] font-medium transition-all duration-150"
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)", color: "rgba(203,213,225,0.8)" }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.08)"; (e.currentTarget as HTMLElement).style.color = "rgba(226,232,240,0.95)"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)"; (e.currentTarget as HTMLElement).style.color = "rgba(203,213,225,0.8)"; }}
          data-testid="button-adjust-settings"
        >
          <Settings className="h-3.5 w-3.5" />
          Adjust settings
        </button>
        <button
          onClick={onSecurity}
          className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-[13px] font-medium transition-all duration-150"
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)", color: "rgba(203,213,225,0.8)" }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.08)"; (e.currentTarget as HTMLElement).style.color = "rgba(226,232,240,0.95)"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)"; (e.currentTarget as HTMLElement).style.color = "rgba(203,213,225,0.8)"; }}
          data-testid="button-security-scan"
        >
          <Shield className="h-3.5 w-3.5" />
          Run security scan
        </button>
      </div>

      {/* Production card */}
      <div className="rounded-2xl p-5" style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)" }}>
        <div className="flex items-center gap-2 mb-4">
          <Globe className="h-4 w-4" style={{ color: "rgba(148,163,184,0.6)" }} />
          <h3 className="text-[13px] font-semibold" style={{ color: "rgba(226,232,240,0.85)" }}>Production</h3>
        </div>

        <Row label="Status">
          <StatusDot status={status} />
          <span style={{ color: cfg.dot }}>{cfg.label}</span>
        </Row>
        <Row label="Visibility"><span>Public</span></Row>
        <Row label="Domain">
          <span className="font-mono text-[12px]" style={{ color: "rgba(124,141,255,0.9)" }}>{MOCK_DOMAIN}</span>
          <button
            onClick={copyDomain}
            className="p-1 rounded-md transition-colors duration-150"
            style={{ color: copied ? "#34d399" : "rgba(148,163,184,0.55)" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.06)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
            title="Copy URL"
            data-testid="button-copy-domain"
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          </button>
          <a
            href={`https://${MOCK_DOMAIN}`}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1 rounded-md transition-colors duration-150"
            style={{ color: "rgba(148,163,184,0.55)" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.06)"; (e.currentTarget as HTMLElement).style.color = "rgba(226,232,240,0.9)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.color = "rgba(148,163,184,0.55)"; }}
            data-testid="link-open-domain"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </Row>
        <Row label="Type">
          <span>Autoscale</span>
          <span className="text-[11px] px-1.5 py-0.5 rounded" style={{ background: "rgba(255,255,255,0.07)", color: "rgba(148,163,184,0.7)" }}>
            0.5 CPU · 512 MB RAM
          </span>
          <button
            className="text-[12px] transition-colors duration-150"
            style={{ color: "rgba(124,141,255,0.8)" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "rgba(167,139,250,1)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "rgba(124,141,255,0.8)"; }}
            data-testid="link-manage-plan"
          >
            Manage
          </button>
        </Row>
      </div>

      {/* Error notice */}
      {status === "failed" && (
        <div className="flex items-start gap-3 p-4 rounded-xl" style={{ background: "rgba(248,113,113,0.07)", border: "1px solid rgba(248,113,113,0.2)" }}>
          <XCircle className="h-4 w-4 mt-0.5 flex-shrink-0" style={{ color: "#f87171" }} />
          <div>
            <p className="text-[13px] font-medium" style={{ color: "#fca5a5" }}>Deployment failed</p>
            <p className="text-[12px] mt-0.5" style={{ color: "rgba(252,165,165,0.7)" }}>
              Build exited with code 1. Check logs for details.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
