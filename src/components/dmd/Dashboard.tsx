import { useState } from "react";
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
  DollarSign,
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
} from "lucide-react";

type Status = "Needs Setup" | "In Review" | "Safe to Use" | "Paused";
type Criticality = "Critical" | "High" | "Medium" | "Low";

const STATUS_STYLES: Record<Status, string> = {
  "Needs Setup": "bg-[color:var(--status-warning-bg)] text-[color:var(--status-warning)]",
  "In Review": "bg-[color:var(--status-info-bg)] text-[color:var(--status-info)]",
  "Safe to Use": "bg-[color:var(--status-healthy-bg)] text-[color:var(--status-healthy)]",
  Paused: "bg-[color:var(--status-neutral-bg)] text-[color:var(--status-neutral)]",
};

const CRIT_STYLES: Record<Criticality, string> = {
  Critical: "bg-[color:var(--status-critical-bg)] text-[color:var(--status-critical)]",
  High: "bg-[color:var(--status-warning-bg)] text-[color:var(--status-warning)]",
  Medium: "bg-[color:var(--status-info-bg)] text-[color:var(--status-info)]",
  Low: "bg-[color:var(--status-neutral-bg)] text-[color:var(--status-neutral)]",
};

const PROVIDER_DATA = [
  { name: "Namecheap", value: 542, color: "#2563EB" },
  { name: "GoDaddy", value: 412, color: "#10B981" },
  { name: "101domain", value: 186, color: "#F59E0B" },
  { name: "Other", value: 108, color: "#8B5CF6" },
];

const RENEWAL_DATA = [
  { bucket: "< 30 days", domains: 37, cost: 3200 },
  { bucket: "30-60 days", domains: 52, cost: 4400 },
  { bucket: "60-90 days", domains: 48, cost: 4100 },
  { bucket: "90+ days", domains: 71, cost: 6800 },
];

const COST_BY_COMPANY = [
  { name: "Acme Corporation", cost: 3240 },
  { name: "Global Media LLC", cost: 2180 },
  { name: "Tech Ventures Inc", cost: 1890 },
  { name: "Alpha Holdings", cost: 1450 },
  { name: "Beta Brands", cost: 880 },
];

const COST_BY_PROVIDER = [
  { name: "Namecheap", value: 5640, color: "#2563EB" },
  { name: "GoDaddy", value: 4150, color: "#10B981" },
  { name: "101domain", value: 1860, color: "#F59E0B" },
  { name: "Other", value: 800, color: "#8B5CF6" },
];

const RECENT_PURCHASES: Array<{ domain: string; date: string; provider: string; status: Status }> = [
  { domain: "brightpath.ai", date: "May 18, 2025", provider: "Namecheap", status: "Needs Setup" },
  { domain: "trackfunnel.com", date: "May 17, 2025", provider: "GoDaddy", status: "In Review" },
  { domain: "sendaxis.net", date: "May 16, 2025", provider: "Namecheap", status: "Safe to Use" },
  { domain: "alphaoffers.io", date: "May 15, 2025", provider: "101domain", status: "Needs Setup" },
  { domain: "revboost.co", date: "May 14, 2025", provider: "GoDaddy", status: "In Review" },
];

const CRITICAL_REPORTS = [
  "14 domains have auto-renew disabled",
  "8 domains missing payment method",
  "6 domains have WHOIS mismatch",
  "3 payment methods expiring soon",
  "23 domains expiring in 30 days",
];

const DOMAINS_ROWS: Array<{
  domain: string;
  purchased: string;
  provider: string;
  account: string;
  identity: string;
  company: string;
  purpose: string;
  usage: string;
  criticality: Criticality;
  status: Status;
  expDate: string;
  expDays: number;
  autoRenew: boolean;
  cost: string;
}> = [
  { domain: "brightpath.ai", purchased: "May 18, 2025", provider: "Namecheap", account: "Main Account", identity: "Michael Brown", company: "BrightPath LLC", purpose: "Primary Brand", usage: "Main Website / Landing Page", criticality: "Critical", status: "Needs Setup", expDate: "Jun 18, 2026", expDays: 30, autoRenew: true, cost: "$89.98" },
  { domain: "trackfunnel.com", purchased: "May 17, 2025", provider: "GoDaddy", account: "Marketing Acc.", identity: "Sarah Johnson", company: "FunnelBoost Inc", purpose: "Tracking Domain", usage: "Tracking Link / Google Ads", criticality: "High", status: "In Review", expDate: "Jul 10, 2026", expDays: 52, autoRenew: true, cost: "$119.88" },
  { domain: "sendaxis.net", purchased: "May 16, 2025", provider: "Namecheap", account: "Main Account", identity: "David Lee", company: "SendAxis Ltd", purpose: "Sending Domain", usage: "Email Sending / Instantly", criticality: "Critical", status: "Safe to Use", expDate: "Apr 22, 2026", expDays: 338, autoRenew: true, cost: "$79.98" },
  { domain: "alphaoffers.io", purchased: "May 15, 2025", provider: "101domain", account: "Account #1", identity: "Emily Davis", company: "Alpha Offers", purpose: "Marketing Brand", usage: "Landing Page / Meta Ads", criticality: "Medium", status: "Needs Setup", expDate: "May 05, 2026", expDays: 351, autoRenew: false, cost: "$59.99" },
  { domain: "revboost.co", purchased: "May 14, 2025", provider: "GoDaddy", account: "Main Account", identity: "Michael Brown", company: "RevBoost LLC", purpose: "Project Specific", usage: "Project Landing / Testing", criticality: "Low", status: "Paused", expDate: "Feb 14, 2026", expDays: 270, autoRenew: true, cost: "$44.99" },
];

function StatusBadge({ value }: { value: Status }) {
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[value]}`}>
      {value}
    </span>
  );
}
function CritBadge({ value }: { value: Criticality }) {
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${CRIT_STYLES[value]}`}>
      {value}
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
            <span className={`inline-flex items-center gap-1 font-medium ${trendNegative ? "text-[color:var(--status-critical)]" : "text-[color:var(--status-healthy)]"}`}>
              <TrendingUp className="h-3 w-3" /> {trend}
            </span>
          ) : <span />}
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

export function Dashboard() {
  const [tab, setTab] = useState<"ceo" | "ops">("ceo");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Dashboard Overview</h1>
          <p className="text-sm text-muted-foreground">Real-time overview of your domain portfolio and key metrics</p>
        </div>
      </div>

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
        <Kpi icon={Globe} label="Total Domains" value="1,248" tile="var(--tile-blue)" iconColor="#2563EB" trend="12 this week" />
        <Kpi icon={ShieldAlert} label="Critical Domains" value="23" tile="var(--tile-red)" iconColor="#DC2626" trend="2 this week" trendNegative />
        <Kpi icon={CalendarDays} label="Expiring in 30 Days" value="37" tile="var(--tile-violet)" iconColor="#7C3AED" link="View details" />
        <Kpi icon={CalendarRange} label="Expiring in 60 Days" value="89" tile="var(--tile-amber)" iconColor="#D97706" link="View details" />
        <Kpi icon={DollarSign} label="Monthly Renewal Cost" value="$12,450.00" tile="var(--tile-emerald)" iconColor="#059669" link="View report" />
        <Kpi icon={AlertTriangle} label="Domains At Risk" value="14" tile="var(--tile-red)" iconColor="#DC2626" link="View details" />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card title="Domains by Provider">
          <div className="flex items-center gap-4">
            <div className="h-48 w-48 shrink-0">
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={PROVIDER_DATA} dataKey="value" innerRadius={48} outerRadius={80} paddingAngle={2}>
                    {PROVIDER_DATA.map((p) => <Cell key={p.name} fill={p.color} />)}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="flex-1 space-y-2 text-sm">
              {PROVIDER_DATA.map((p) => {
                const total = PROVIDER_DATA.reduce((s, x) => s + x.value, 0);
                const pct = ((p.value / total) * 100).toFixed(1);
                return (
                  <li key={p.name} className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: p.color }} />
                      <span className="text-foreground">{p.name}</span>
                    </span>
                    <span className="text-muted-foreground">{p.value} ({pct}%)</span>
                  </li>
                );
              })}
            </ul>
          </div>
        </Card>

        <Card title="Renewals Overview">
          <div className="h-60">
            <ResponsiveContainer>
              <BarChart data={RENEWAL_DATA} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
                <XAxis dataKey="bucket" tick={{ fontSize: 11, fill: "#6B7280" }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="left" tick={{ fontSize: 11, fill: "#6B7280" }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: "#6B7280" }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v / 1000}K`} />
                <Tooltip />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                <Bar yAxisId="left" dataKey="domains" fill="#2563EB" radius={[4, 4, 0, 0]} name="Domains" />
                <Bar yAxisId="right" dataKey="cost" fill="#10B981" radius={[4, 4, 0, 0]} name="Cost (USD)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <a className="mt-2 block text-center text-xs font-medium text-primary hover:underline" href="#">
            View all expiring domains →
          </a>
        </Card>

        <Card title="Cost by Company (Top 5)">
          <ul className="divide-y divide-border">
            {COST_BY_COMPANY.map((c) => (
              <li key={c.name} className="flex items-center justify-between py-2.5 text-sm">
                <span className="text-foreground">{c.name}</span>
                <span className="font-medium text-foreground tabular-nums">${c.cost.toLocaleString()}.00</span>
              </li>
            ))}
          </ul>
          <a className="mt-3 block text-center text-xs font-medium text-primary hover:underline" href="#">
            View full report →
          </a>
        </Card>
      </div>

      {/* Lower row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card title="Recently Purchased Domains">
          <ul className="divide-y divide-border">
            {RECENT_PURCHASES.map((r) => (
              <li key={r.domain} className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-3 py-2.5 text-sm">
                <a href="#" className="inline-flex items-center gap-1 text-primary hover:underline truncate">
                  <ExternalLink className="h-3 w-3 shrink-0" /> {r.domain}
                </a>
                <span className="text-muted-foreground whitespace-nowrap">{r.date}</span>
                <span className="text-foreground whitespace-nowrap">{r.provider}</span>
                <StatusBadge value={r.status} />
              </li>
            ))}
          </ul>
          <a className="mt-3 block text-center text-xs font-medium text-primary hover:underline" href="#">
            View all purchases →
          </a>
        </Card>

        <Card title="Critical Reports">
          <ul className="space-y-3">
            {CRITICAL_REPORTS.map((r, i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--status-critical)]" />
                <span className="text-foreground">{r}</span>
              </li>
            ))}
          </ul>
          <a className="mt-3 block text-center text-xs font-medium text-primary hover:underline" href="#">
            View all critical issues →
          </a>
        </Card>

        <Card title="Cost by Provider">
          <ul className="space-y-3">
            {COST_BY_PROVIDER.map((p) => {
              const max = Math.max(...COST_BY_PROVIDER.map((x) => x.value));
              return (
                <li key={p.name} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="inline-flex items-center gap-2 text-foreground">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: p.color }} />
                      {p.name}
                    </span>
                    <span className="font-medium tabular-nums">${p.value.toLocaleString()}.00</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${(p.value / max) * 100}%`, background: p.color }} />
                  </div>
                </li>
              );
            })}
          </ul>
          <a className="mt-3 block text-center text-xs font-medium text-primary hover:underline" href="#">
            View full cost report →
          </a>
        </Card>
      </div>

      {/* Domains table */}
      <div className="rounded-xl border border-border bg-card shadow-[var(--shadow-card)]">
        <div className="flex flex-wrap items-start justify-between gap-3 p-5">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Domains</h2>
            <p className="text-sm text-muted-foreground">Manage and monitor all your domains in one place</p>
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

        {/* Filters */}
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-2 px-5">
          <div className="relative col-span-2 md:col-span-2 xl:col-span-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              placeholder="Search domains..."
              className="w-full rounded-md border border-border bg-background py-1.5 pl-8 pr-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/30"
            />
          </div>
          {["Provider", "Provider Account", "Identity", "Company", "Status", "Criticality", "Purpose"].map((f) => (
            <FilterSelect key={f} label={f} />
          ))}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-2 px-5 pt-2">
          {["Expiration", "Auto-Renew", "Payment Method", "Usage", "Platform", "Missing Owner"].map((f) => (
            <FilterSelect key={f} label={f} />
          ))}
          <div className="flex items-center gap-2 col-span-2 xl:col-span-1 justify-end">
            <button className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-accent">
              <SlidersHorizontal className="h-3.5 w-3.5" /> More Filters
            </button>
            <button className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-primary hover:bg-accent">
              <RotateCcw className="h-3.5 w-3.5" /> Clear Filters
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-y border-border bg-muted/30 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-5 py-2 text-left"><input type="checkbox" /></th>
                {["Domain", "Provider / Account", "Identity", "Company", "Purpose", "Usage", "Criticality", "Status", "Exp. Date", "Auto-Renew", "Renewal Cost", "Actions"].map((h) => (
                  <th key={h} className="px-3 py-2 text-left font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {DOMAINS_ROWS.map((r) => (
                <tr key={r.domain} className="hover:bg-muted/30">
                  <td className="px-5 py-3"><input type="checkbox" /></td>
                  <td className="px-3 py-3">
                    <div className="font-medium text-foreground">{r.domain}</div>
                    <div className="text-xs text-muted-foreground">Purchased: {r.purchased}</div>
                  </td>
                  <td className="px-3 py-3">
                    <div className="text-foreground">{r.provider}</div>
                    <div className="text-xs text-muted-foreground">{r.account}</div>
                  </td>
                  <td className="px-3 py-3 text-primary"><a href="#" className="hover:underline">{r.identity}</a></td>
                  <td className="px-3 py-3 text-primary"><a href="#" className="hover:underline">{r.company}</a></td>
                  <td className="px-3 py-3 text-foreground">{r.purpose}</td>
                  <td className="px-3 py-3 text-foreground">{r.usage}</td>
                  <td className="px-3 py-3"><CritBadge value={r.criticality} /></td>
                  <td className="px-3 py-3"><StatusBadge value={r.status} /></td>
                  <td className="px-3 py-3">
                    <div className="text-foreground whitespace-nowrap" style={{ color: r.expDays <= 30 ? "var(--status-critical)" : undefined }}>{r.expDate}</div>
                    <div className="text-xs text-muted-foreground">({r.expDays} days)</div>
                  </td>
                  <td className="px-3 py-3">
                    <span className={`inline-flex h-5 w-9 items-center rounded-full px-0.5 ${r.autoRenew ? "bg-primary" : "bg-muted"}`}>
                      <span className={`h-4 w-4 rounded-full bg-white transition ${r.autoRenew ? "translate-x-4" : ""}`} />
                    </span>
                  </td>
                  <td className="px-3 py-3 font-medium tabular-nums">{r.cost}</td>
                  <td className="px-3 py-3">
                    <button className="inline-flex h-7 w-7 items-center justify-center rounded-md hover:bg-accent">
                      <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-5 py-3 text-sm text-muted-foreground">
          <div>Showing 1 to 25 of 1,248 domains</div>
          <div className="flex items-center gap-1">
            <PageBtn>‹</PageBtn>
            <PageBtn active>1</PageBtn>
            <PageBtn>2</PageBtn>
            <PageBtn>3</PageBtn>
            <span className="px-2">...</span>
            <PageBtn>50</PageBtn>
            <PageBtn>›</PageBtn>
            <select className="ml-2 rounded-md border border-border bg-background px-2 py-1 text-xs">
              <option>25 / page</option>
              <option>50 / page</option>
              <option>100 / page</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}

function FilterSelect({ label }: { label: string }) {
  return (
    <div className="text-xs">
      <label className="block text-muted-foreground mb-1">{label}</label>
      <select className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring/30">
        <option>All</option>
      </select>
    </div>
  );
}

function PageBtn({ children, active }: { children: React.ReactNode; active?: boolean }) {
  return (
    <button
      className={`inline-flex h-7 min-w-7 items-center justify-center rounded-md border px-2 text-xs font-medium ${
        active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background hover:bg-accent"
      }`}
    >
      {children}
    </button>
  );
}
