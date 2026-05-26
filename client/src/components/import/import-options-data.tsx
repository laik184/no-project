import { ArrowRight, Code2, Palette, Files } from "lucide-react";
import { SiGithub, SiFigma, SiBitbucket } from "react-icons/si";

export const categories = [
  { id: "all", label: "All", icon: ArrowRight },
  { id: "code", label: "Code", icon: Code2 },
  { id: "design", label: "Design", icon: Palette },
  { id: "files", label: "Files", icon: Files },
];

export const importOptions = [
  {
    id: "github",
    title: "GitHub",
    description: "Import any repository or existing app. Agent may be less predictable.",
    icon: SiGithub,
    iconBg: "bg-[#24292e]",
    iconColor: "text-white",
    category: "code",
    action: "connect",
    actionLabel: "Connect GitHub",
    detailDescription: "Link your GitHub account to browse and import any public or private repository directly into your workspace.",
    route: "/import/github",
  },
  {
    id: "bitbucket",
    title: "Bitbucket",
    description: "Import a repository or existing app. Agent support may be limited.",
    icon: SiBitbucket,
    iconBg: "bg-[#0052cc]",
    iconColor: "text-white",
    category: "code",
    action: "connect",
    actionLabel: "Connect Bitbucket",
    detailDescription: "Authenticate with Bitbucket and import any of your repositories to get started quickly.",
    route: null,
  },
  {
    id: "bolt",
    title: "Bolt",
    description: "Migrate your prototype to make it production-ready.",
    icon: () => (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
        <path d="M13 2L3 14h8l-1 8 10-12h-8l1-8z" />
      </svg>
    ),
    iconBg: "bg-[#4a90e2]",
    iconColor: "text-white",
    category: "code",
    action: "connect",
    actionLabel: "Import from Bolt",
    detailDescription: "Migrate your Bolt prototype into a production-ready environment with full Agent support.",
    route: "/import/bolt",
  },
  {
    id: "vercel",
    title: "Vercel",
    description: "Migrate your site to make it production-ready.",
    icon: () => (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
        <path d="M12 2L2 22h20L12 2z" />
      </svg>
    ),
    iconBg: "bg-[#000000]",
    iconColor: "text-white",
    category: "code",
    action: "connect",
    actionLabel: "Import from Vercel",
    detailDescription: "Pull your Vercel project and continue development with full deployment capabilities.",
    route: "/import/vercel",
  },
  {
    id: "figma",
    title: "Figma Design",
    description: "Convert your designs into live Apps using Agent.",
    icon: SiFigma,
    iconBg: "bg-gradient-to-br from-[#f24e1e] via-[#a259ff] to-[#1abcfe]",
    iconColor: "text-white",
    category: "design",
    action: "connect",
    actionLabel: "Connect Figma",
    detailDescription: "Import your Figma frames and let the Agent convert them into fully working React components.",
    route: "/import/figma",
  },
  {
    id: "lovable",
    title: "Lovable",
    description: "Migrate your site to make it production-ready.",
    icon: () => (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
        <path d="M12 21.593c-5.63-5.539-11-10.297-11-14.402 0-3.791 3.068-5.191 5.281-5.191 1.312 0 4.151.501 5.719 4.457 1.59-3.968 4.464-4.447 5.726-4.447 2.54 0 5.274 1.621 5.274 5.181 0 4.069-5.136 8.625-11 14.402z" />
      </svg>
    ),
    iconBg: "bg-[#ff6b6b]",
    iconColor: "text-white",
    category: "design",
    action: "connect",
    actionLabel: "Import from Lovable",
    detailDescription: "Migrate your Lovable project and continue building with the full power of the Agent.",
    route: "/import/lovable",
  },
  {
    id: "base44",
    title: "Base44",
    description: "Migrate your site to make it production-ready.",
    icon: () => (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
        <circle cx="12" cy="12" r="10" />
        <text x="12" y="16" textAnchor="middle" fontSize="9" fill="white" fontWeight="bold">44</text>
      </svg>
    ),
    iconBg: "bg-[#2d2d2d]",
    iconColor: "text-white",
    category: "design",
    action: "connect",
    actionLabel: "Import from Base44",
    detailDescription: "Bring your Base44 project into a production environment with zero configuration.",
    route: "/import/base44",
  },
  {
    id: "zip",
    title: "Zip File",
    description: "Import from a .zip file.",
    icon: undefined as unknown as React.ElementType,
    iconBg: "bg-[#f59e0b]/20",
    iconColor: "text-[#f59e0b]",
    category: "files",
    action: "upload",
    actionLabel: "Upload .zip File",
    detailDescription: "Drag and drop or browse to upload a .zip archive. We'll extract and set it up automatically.",
    route: null,
  },
];

export type ImportOption = typeof importOptions[0];
