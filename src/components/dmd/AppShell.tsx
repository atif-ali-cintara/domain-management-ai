import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Globe,
  Users,
  Building2,
  KeyRound,
  CreditCard,
  Monitor,
  FileBarChart,
  BellRing,
  Upload,
  ScrollText,
  Settings,
  Bell,
  HelpCircle,
} from "lucide-react";
import type { ComponentType, SVGProps } from "react";

type NavItem = { to: string; label: string; icon: ComponentType<SVGProps<SVGSVGElement>> };

const NAV: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/domains", label: "Domains", icon: Globe },
  { to: "/identities", label: "Identities", icon: Users },
  { to: "/companies", label: "Companies", icon: Building2 },
  { to: "/registrars", label: "Registrar Accounts", icon: KeyRound },
  { to: "/payment-methods", label: "Payment Methods", icon: CreditCard },
  { to: "/usage", label: "Usage & Platforms", icon: Monitor },
  { to: "/reports", label: "Reports", icon: FileBarChart },
  { to: "/tasks", label: "Tasks & Alerts", icon: BellRing },
  { to: "/import-export", label: "Import / Export", icon: Upload },
  { to: "/audit-log", label: "Audit Log", icon: ScrollText },
  { to: "/settings", label: "Settings", icon: Settings },
];

export function AppShell() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="flex min-h-screen w-full bg-background text-foreground">
      <aside className="hidden md:flex w-64 shrink-0 flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border">
        <div className="flex items-center gap-2 px-5 py-5 border-b border-sidebar-border">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
            <Globe className="h-5 w-5" />
          </div>
          <div className="leading-tight">
            <div className="text-sm font-semibold text-white">Domain</div>
            <div className="text-sm font-semibold text-white -mt-0.5">Management</div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto py-3">
          <ul className="space-y-0.5 px-2">
            {NAV.map((item) => {
              const active = pathname === item.to || (item.to !== "/dashboard" && pathname.startsWith(item.to));
              const Icon = item.icon;
              return (
                <li key={item.to}>
                  <Link
                    to={item.to}
                    className={[
                      "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                      active
                        ? "bg-sidebar-primary text-sidebar-primary-foreground"
                        : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-white",
                    ].join(" ")}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="m-3 rounded-lg bg-sidebar-accent/60 p-3 text-xs">
          <div className="flex items-center gap-2 font-medium text-white">
            <HelpCircle className="h-4 w-4" />
            Need help?
          </div>
          <p className="mt-1 text-sidebar-foreground/70">
            View documentation and guides
          </p>
          <button className="mt-3 w-full rounded-md bg-white/10 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/15">
            View Docs
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-10 flex h-16 items-center justify-between gap-4 border-b border-border bg-card/80 px-6 backdrop-blur">
          <div />
          <div className="flex items-center gap-3">
            <div className="hidden md:flex items-center gap-2 rounded-md border border-border bg-background px-3 py-1.5 text-xs text-muted-foreground">
              May 12 – May 19, 2025
            </div>
            <button className="relative inline-flex h-9 w-9 items-center justify-center rounded-md border border-border bg-background text-muted-foreground hover:text-foreground">
              <Bell className="h-4 w-4" />
              <span className="absolute -right-1 -top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-[color:var(--status-critical)] px-1 text-[10px] font-semibold text-white">
                9
              </span>
            </button>
            <div className="flex items-center gap-2 rounded-md border border-border bg-background pl-2 pr-3 py-1">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-semibold">
                AM
              </div>
              <div className="text-xs leading-tight">
                <div className="font-medium">Admin User</div>
                <div className="text-muted-foreground">All Access</div>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 px-6 py-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
