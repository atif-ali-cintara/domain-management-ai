import { useState, useMemo } from "react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import {
  Globe,
  ShieldAlert,
  CalendarDays,
  CalendarRange,
  AlertTriangle,
  ArrowUpRight,
  Plus,
  Upload,
  Download,
  Search,
  SlidersHorizontal,
  RotateCcw,
  MoreHorizontal,
  ExternalLink,
  TrendingUp,
  RefreshCw,
} from "lucide-react";
import type { Portfolio, PortfolioDomain } from "@/lib/portfolio.functions";

type StatusTone = "healthy" | "warning" | "critical" | "neutral" | "info";

function statusTone(d: PortfolioDomain): StatusTone {
  if (d.expiresInDays != null && d.expiresInDays < 0) return "critical";
  if (d.expiresInDays != null && d.expiresInDays < 30) return "critical";
  if (!d.autoRenew) return "warning";
  if (d.status && d.status !== "ACTIVE") return "info";
  return "healthy";
}

const TONE_STYLES: Record<StatusTone, string> = {
  healthy: "bg-[color:var(--status-healthy-bg)] text-[color:var(--status-healthy)]",
  warning: "bg-[color:var(--status-warning-bg)] text-[color:var(--status-warning)]",
  critical: "bg-[color:var(--status-critical-bg)] text-[color:var(--status-critical)]",
  neutral: "bg-[color:var(--status-neutral-bg)] text-[color:var(--status-neutral)]",
  info: "bg-[color:var(--status-info-bg)] text-[color:var(--status-info)]",
};

function ToneBadge({ tone, children }: { tone: StatusTone; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${TONE_STYLES[tone]}`}>
      {children}
    </span>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
  tile,
  iconColor,
  trend,
  link,
  trendNegative,
}: {
  icon: typeof Globe;
  label: string;
  value: string;
  tile: string;
  iconColor: string;
  trend?: string;
  link?: string;
  trendNegative?: boolean;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-card-hover)] transition-shadow">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg" style={{ background: tile }}>
          <Icon className="h-5 w-5" style={{ color: iconColor }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs text-muted-foreground truncate">{label}</div>
          <div className="mt-0.5 text-2xl font-semibold tracking-tight text-foreground">{value}</div>
        </div>
      </div>
      {(trend || link) && (
        <div className="mt-3 flex items-center justify-between text-xs">
          {trend ? (
            <span
              className={`inline-flex items-center gap-1 font-medium ${
                trendNegative ? "text-[color:var(--status-critical)]" : "text-[color:var(--status-healthy)]"
              }`}
            >
              <TrendingUp className="h-3 w-3" /> {trend}
            </span>
          ) : (
            <span />
          )}
          {link && (
            <a className="inline-flex items-center gap-0.5 font-medium text-primary hover:underline" href="#">
              {link} <ArrowUpRight className="h-3 w-3" />
            </a>
          )}
        </div>
      )}
    </div>
  );
}

function Card({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {action}
      </div>
      <div className="mt-4">{children}</div>
    </div>
  );
}

function formatDate(iso: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
  } catch {
    return iso;
  }
}

export function Dashboard({ portfolio }: { portfolio: Portfolio }) {
  const [tab, setTab] = useState<"ceo" | "ops">("ceo");
  const [query, setQuery] = useState("");
  const { totals, providerCounts, buckets, recent, criticalReports, topCompanies, domains, fetchedAt, errors } = portfolio;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return domains;
    return domains.filter(
      (d) =>
        d.domain.toLowerCase().includes(q) ||
        (d.company ?? "").toLowerCase().includes(q) ||
        (d.identity ?? "").toLowerCase().includes(q),
    );
  }, [domains, query]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Dashboard Overview</h1>
          <p className="text-sm text-muted-foreground">
            Live portfolio across registrar accounts · {domains.length} domains · updated {formatDate(fetchedAt)}
          </p>
        </div>
        <button
          onClick={() => window.location.reload()}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium hover:bg-accent"
        >
          <RefreshCw className="h-4 w-4" /> Refresh
        </button>
      </div>

      {errors.length > 0 && (
        <div className="rounded-lg border border-[color:var(--status-warning)]/30 bg-[color:var(--status-warning-bg)]/40 p-3 text-sm text-[color:var(--status-warning)]">
          {errors.map((e, i) => (
            <div key={i}>⚠ {e}</div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-6 border-b border-border">
        {(["ceo", "ops"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`pb-2.5 text-sm font-medium transition-colors -mb-px border-b-2 ${
              tab === t ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t === "ceo" ? "CEO Summary" : "Operations View"}
          </button>
        ))}
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4">
        <Kpi icon={Globe} label="Total Domains" value={totals.total.toLocaleString()} tile="var(--tile-blue)" iconColor="#2563EB" />
        <Kpi
          icon={ShieldAlert}
          label="Critical Domains"
          value={totals.critical.toLocaleString()}
          tile="var(--tile-red)"
          iconColor="#DC2626"
          trendNegative
          trend={totals.critical > 0 ? "needs attention" : undefined}
        />
        <Kpi icon={CalendarDays} label="Expiring in 30 Days" value={totals.expiring30.toLocaleString()} tile="var(--tile-violet)" iconColor="#7C3AED" link="View details" />
        <Kpi icon={CalendarRange} label="Expiring in 60 Days" value={totals.expiring60.toLocaleString()} tile="var(--tile-amber)" iconColor="#D97706" link="View details" />
        <Kpi icon={AlertTriangle} label="Auto-Renew Off" value={totals.noAutoRenew.toLocaleString()} tile="var(--tile-red)" iconColor="#DC2626" link="View details" />
        <Kpi icon={Globe} label="Unmapped" value={totals.unmapped.toLocaleString()} tile="var(--tile-emerald)" iconColor="#059669" link="Map now" />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card title="Domains by Provider">
          <div className="flex items-center gap-4">
            <div className="h-48 w-48 shrink-0">
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={providerCounts} dataKey="value" innerRadius={48} outerRadius={80} paddingAngle={2}>
                    {providerCounts.map((p) => (
                      <Cell key={p.name} fill={p.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="flex-1 space-y-2 text-sm">
              {providerCounts.map((p) => {
                const total = providerCounts.reduce((s, x) => s + x.value, 0) || 1;
                const pct = ((p.value / total) * 100).toFixed(1);
                return (
                  <li key={p.name} className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: p.color }} />
                      <span className="text-foreground">{p.name}</span>
                    </span>
                    <span className="text-muted-foreground">
                      {p.value} ({pct}%)
                    </span>
                  </li>
                );
              })}
              {providerCounts.length === 0 && (
                <li className="text-muted-foreground">No domains loaded yet.</li>
              )}
            </ul>
          </div>
        </Card>

        <Card title="Renewals Overview">
          <div className="h-60">
            <ResponsiveContainer>
              <BarChart data={buckets} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
                <XAxis dataKey="bucket" tick={{ fontSize: 11, fill: "#6B7280" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#6B7280" }} axisLine={false} tickLine={false} />
                <Tooltip />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="domains" fill="#2563EB" radius={[4, 4, 0, 0]} name="Domains" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="Top Companies by Domain Count">
          <ul className="divide-y divide-border">
            {topCompanies.map((c) => (
              <li key={c.name} className="flex items-center justify-between py-2.5 text-sm">
                <span className="text-foreground truncate pr-2">{c.name}</span>
                <span className="font-medium text-foreground tabular-nums">{c.count}</span>
              </li>
            ))}
            {topCompanies.length === 0 && <li className="py-2 text-sm text-muted-foreground">No data.</li>}
          </ul>
        </Card>
      </div>

      {/* Lower row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title="Recently Added Domains">
          <ul className="divide-y divide-border">
            {recent.map((r) => (
              <li key={r.domain} className="grid grid-cols-[1fr_auto_auto] items-center gap-3 py-2.5 text-sm">
                <a href="#" className="inline-flex items-center gap-1 text-primary hover:underline truncate">
                  <ExternalLink className="h-3 w-3 shrink-0" /> {r.domain}
                </a>
                <span className="text-muted-foreground whitespace-nowrap">{formatDate(r.createdAt)}</span>
                <ToneBadge tone={statusTone(r)}>{r.status}</ToneBadge>
              </li>
            ))}
            {recent.length === 0 && <li className="py-2 text-sm text-muted-foreground">No domains found.</li>}
          </ul>
        </Card>

        <Card title="Critical Reports">
          <ul className="space-y-3">
            {criticalReports.map((r, i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--status-critical)]" />
                <span className="text-foreground">{r}</span>
              </li>
            ))}
            {criticalReports.length === 0 && (
              <li className="text-sm text-muted-foreground">No critical issues 🎉</li>
            )}
          </ul>
        </Card>
      </div>

      {/* Domains table */}
      <div className="rounded-xl border border-border bg-card shadow-[var(--shadow-card)]">
        <div className="flex flex-wrap items-start justify-between gap-3 p-5">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Domains</h2>
            <p className="text-sm text-muted-foreground">
              Live from registrars · mapped to companies & identities via Migration Plan
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium hover:bg-accent">
              <Upload className="h-4 w-4" /> Import Domains
            </button>
            <button className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium hover:bg-accent">
              <Download className="h-4 w-4" /> Export
            </button>
            <button className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90">
              <Plus className="h-4 w-4" /> Add Domain
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="px-5 pb-3">
          <div className="relative max-w-md">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search domain, company, identity…"
              className="w-full rounded-md border border-border bg-background py-1.5 pl-8 pr-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/30"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 px-5 pb-4 text-xs text-muted-foreground">
          <button className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 font-medium hover:bg-accent">
            <SlidersHorizontal className="h-3.5 w-3.5" /> More Filters
          </button>
          <button className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium text-primary hover:bg-accent">
            <RotateCcw className="h-3.5 w-3.5" /> Clear
          </button>
          <span className="ml-auto">{filtered.length} of {domains.length} domains</span>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-y border-border bg-muted/30 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                {["Domain", "Provider / Account", "Identity", "Company", "Status", "Exp. Date", "Days", "Auto-Renew", ""].map((h) => (
                  <th key={h} className="px-3 py-2 text-left font-medium first:pl-5">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.slice(0, 100).map((r) => {
                const tone = statusTone(r);
                return (
                  <tr key={r.domain} className="hover:bg-muted/30">
                    <td className="px-3 py-3 pl-5">
                      <div className="font-medium text-foreground">{r.domain}</div>
                      <div className="text-xs text-muted-foreground">Added: {formatDate(r.createdAt)}</div>
                    </td>
                    <td className="px-3 py-3">
                      <div className="text-foreground">{r.provider}</div>
                      <div className="text-xs text-muted-foreground">{r.account}</div>
                    </td>
                    <td className="px-3 py-3 text-primary">
                      {r.identity ?? <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-3 py-3 text-primary">
                      {r.company ?? <span className="text-muted-foreground">Unmapped</span>}
                    </td>
                    <td className="px-3 py-3"><ToneBadge tone={tone}>{r.status}</ToneBadge></td>
                    <td className="px-3 py-3 whitespace-nowrap">{formatDate(r.expires)}</td>
                    <td
                      className="px-3 py-3 tabular-nums"
                      style={{ color: r.expiresInDays != null && r.expiresInDays < 30 ? "var(--status-critical)" : undefined }}
                    >
                      {r.expiresInDays ?? "—"}
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className={`inline-flex h-5 w-9 items-center rounded-full px-0.5 ${r.autoRenew ? "bg-primary" : "bg-muted"}`}
                      >
                        <span className={`h-4 w-4 rounded-full bg-white transition ${r.autoRenew ? "translate-x-4" : ""}`} />
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <button className="inline-flex h-7 w-7 items-center justify-center rounded-md hover:bg-accent">
                        <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                      </button>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-5 py-10 text-center text-sm text-muted-foreground">
                    No domains match your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between border-t border-border px-5 py-3 text-sm text-muted-foreground">
          <div>Showing {Math.min(filtered.length, 100)} of {filtered.length}</div>
          {filtered.length > 100 && <div className="text-xs">Pagination coming soon</div>}
        </div>
      </div>
    </div>
  );
}
