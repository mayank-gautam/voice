"use client";

import { cn } from "@/lib/utils";
import { NavLink } from "@/components/NavLink";
import {
  LayoutDashboard,
  Phone,
  PhoneOutgoing,
  Activity,
  DollarSign,
  AlertTriangle,
  FileText,
  Settings,
  Cpu,
  BarChart3,
  Shield,
  Mic,
  Brain,
  LogOut,
  GitBranch,
  CheckSquare,
  ScrollText,
  Target,
  Users,
  MessageSquare,
  FlaskConical,
  BellRing,
  LineChart,
  Network,
  ClipboardCheck,
  PhoneCall,
} from "lucide-react";

import { clearAllCredentials } from "@/lib/credentials-store";

const navigation = [
  { name: "Overview", href: "/", icon: LayoutDashboard },
  { name: "Calls", href: "/calls", icon: Phone },
 // { name: "Outbound Calls", href: "/outbound-calls", icon: PhoneOutgoing },
  { name: "Simulate Call", href: "/test-call", icon: PhoneCall },
  //{ name: "Sessions", href: "/sessions", icon: MessageSquare },
  //{ name: "Traces", href: "/traces", icon: GitBranch },
  //{ name: "Service Map", href: "/service-map", icon: Network },
  //{ name: "Metric Explorer", href: "/metrics", icon: LineChart },
  //{ name: "Evaluations", href: "/evaluations", icon: CheckSquare },
  //{ name: "Datasets", href: "/datasets", icon: FlaskConical },
  //{ name: "Workflow Simulation", href: "/workflow-simulation", icon: ClipboardCheck },
  //{ name: "Prompts", href: "/prompts", icon: ScrollText },
  //{ name: "SLOs", href: "/slos", icon: Target },
  //{ name: "AI Performance", href: "/ai-performance", icon: Brain },
  //{ name: "System Health", href: "/system-health", icon: Activity },
  //{ name: "Costs", href: "/costs", icon: DollarSign },
  //{ name: "Tenants", href: "/tenants", icon: Users },
  //{ name: "Alert Rules", href: "/alert-rules", icon: BellRing },
  //{ name: "Alerts", href: "/alerts", icon: AlertTriangle },
  { name: "Logs & Traces", href: "/logs", icon: FileText },
  //{ name: "Voice Quality", href: "/voice-quality", icon: Mic },
  //{ name: "Behavior", href: "/behavior", icon: BarChart3 },
  //{ name: "Security", href: "/security", icon: Shield },
];

interface SidebarProps {
  className?: string;
}

export const Sidebar = ({ className }: SidebarProps) => {
  const handleLogout = async () => {
    try {
      await clearAllCredentials();
    } catch {
      /* ignore */
    }
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    window.location.href = "/sso";
  };

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-40 h-screen w-64 border-r border-border/50 bg-sidebar",
        className
      )}
    >
      <div className="flex h-full flex-col">
        <div className="flex h-16 items-center gap-3 border-b border-border/50 px-6">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10">
            <Cpu className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="font-semibold text-sm">VoiceAI</h1>
            <p className="text-xs text-muted-foreground">Observability</p>
          </div>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-4 overflow-y-auto scrollbar-thin">
          {navigation.map((item) => (
            <NavLink
              key={item.name}
              href={item.href}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )
              }
            >
              <item.icon className="w-4 h-4" />
              {item.name}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-border/50 p-4 space-y-1">
          <NavLink
            href="/settings"
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <Settings className="w-4 h-4" />
            Settings
          </NavLink>
          <NavLink
            href="/sso"
            onClick={() => void handleLogout()}
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </NavLink>
        </div>
      </div>
    </aside>
  );
};
