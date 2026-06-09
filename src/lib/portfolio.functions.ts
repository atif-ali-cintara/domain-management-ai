import { createServerFn } from "@tanstack/react-start";
import { companies, domains as csvDomains, identities } from "./migration-data";

export type PortfolioDomain = {
  domain: string;
  provider: string;
  account: string;
  status: string;
  expires: string | null;
  expiresInDays: number | null;
  autoRenew: boolean;
  createdAt: string | null;
  company: string | null;
  identity: string | null;
};

export type Portfolio = {
  domains: PortfolioDomain[];
  totals: {
    total: number;
    expiring30: number;
    expiring60: number;
    critical: number;
    noAutoRenew: number;
    unmapped: number;
  };
  providerCounts: { name: string; value: number; color: string }[];
  buckets: { bucket: string; domains: number }[];
  recent: PortfolioDomain[];
  criticalReports: string[];
  topCompanies: { name: string; count: number }[];
  fetchedAt: string;
  errors: string[];
};

const COLORS = ["#2563EB", "#10B981", "#F59E0B", "#8B5CF6", "#EC4899", "#14B8A6"];

type GoDaddyDomain = {
  domain: string;
  status?: string;
  expires?: string;
  createdAt?: string;
  renewAuto?: boolean;
};

async function fetchGoDaddy(): Promise<{ list: GoDaddyDomain[]; error?: string }> {
  const key = process.env.GODADDY_API_KEY;
  const secret = process.env.GODADDY_API_SECRET;
  if (!key || !secret) {
    return { list: [], error: "GoDaddy credentials missing (GODADDY_API_KEY / GODADDY_API_SECRET)" };
  }
  const out: GoDaddyDomain[] = [];
  let marker: string | undefined;
  try {
    for (let i = 0; i < 20; i++) {
      const url = new URL("https://api.godaddy.com/v1/domains");
      url.searchParams.set("limit", "1000");
      if (marker) url.searchParams.set("marker", marker);
      const res = await fetch(url, {
        headers: { Authorization: `sso-key ${key}:${secret}`, Accept: "application/json" },
      });
      if (!res.ok) {
        const t = await res.text();
        return { list: out, error: `GoDaddy ${res.status}: ${t.slice(0, 200)}` };
      }
      const batch = (await res.json()) as GoDaddyDomain[];
      if (!Array.isArray(batch) || batch.length === 0) break;
      out.push(...batch);
      if (batch.length < 1000) break;
      marker = batch[batch.length - 1]?.domain;
      if (!marker) break;
    }
    return { list: out };
  } catch (e) {
    return { list: out, error: e instanceof Error ? e.message : "Network error" };
  }
}

export const getPortfolio = createServerFn({ method: "GET" }).handler(async (): Promise<Portfolio> => {
  // Build domain → {company, identity} lookup from CSV
  const lookup = new Map<string, { company: string; identity: string }>();
  for (const d of csvDomains) {
    lookup.set(d.domain.toLowerCase(), { company: d.company, identity: d.owner });
  }

  const errors: string[] = [];
  const { list: gd, error: gdErr } = await fetchGoDaddy();
  if (gdErr) errors.push(gdErr);

  const now = Date.now();
  const domains: PortfolioDomain[] = gd.map((g) => {
    const meta = lookup.get(g.domain.toLowerCase());
    const expires = g.expires ? new Date(g.expires) : null;
    const expiresInDays = expires ? Math.round((expires.getTime() - now) / 86_400_000) : null;
    return {
      domain: g.domain,
      provider: "GoDaddy",
      account: "GoDaddy Main",
      status: g.status ?? "UNKNOWN",
      expires: g.expires ?? null,
      expiresInDays,
      autoRenew: !!g.renewAuto,
      createdAt: g.createdAt ?? null,
      company: meta?.company ?? null,
      identity: meta?.identity ?? null,
    };
  });

  // Provider counts
  const providerMap: Record<string, number> = {};
  for (const d of domains) providerMap[d.provider] = (providerMap[d.provider] ?? 0) + 1;
  const providerCounts = Object.entries(providerMap).map(([name, value], i) => ({
    name,
    value,
    color: COLORS[i % COLORS.length],
  }));

  // Renewal buckets
  const bucketMap = { "< 30 days": 0, "30-60 days": 0, "60-90 days": 0, "90+ days": 0 };
  for (const d of domains) {
    if (d.expiresInDays == null) continue;
    if (d.expiresInDays < 30) bucketMap["< 30 days"]++;
    else if (d.expiresInDays < 60) bucketMap["30-60 days"]++;
    else if (d.expiresInDays < 90) bucketMap["60-90 days"]++;
    else bucketMap["90+ days"]++;
  }
  const buckets = Object.entries(bucketMap).map(([bucket, n]) => ({ bucket, domains: n }));

  // Totals
  const expiring30 = bucketMap["< 30 days"];
  const expiring60 = bucketMap["< 30 days"] + bucketMap["30-60 days"];
  const noAutoRenew = domains.filter((d) => !d.autoRenew).length;
  const unmapped = domains.filter((d) => !d.company).length;
  const critical = domains.filter(
    (d) => (d.expiresInDays != null && d.expiresInDays < 30) || !d.autoRenew,
  ).length;

  // Recent
  const recent = [...domains]
    .filter((d) => d.createdAt)
    .sort((a, b) => (b.createdAt! > a.createdAt! ? 1 : -1))
    .slice(0, 5);

  // Critical reports
  const criticalReports: string[] = [];
  if (noAutoRenew > 0) criticalReports.push(`${noAutoRenew} domains have auto-renew disabled`);
  if (expiring30 > 0) criticalReports.push(`${expiring30} domains expiring in 30 days`);
  if (unmapped > 0) criticalReports.push(`${unmapped} domains not yet mapped to a company`);
  const lockedIssues = domains.filter((d) => d.status && !["ACTIVE"].includes(d.status)).length;
  if (lockedIssues > 0) criticalReports.push(`${lockedIssues} domains not in ACTIVE status`);
  if (errors.length) criticalReports.push(...errors);

  // Top companies by domain count
  const companyMap: Record<string, number> = {};
  for (const d of domains) {
    const c = d.company ?? "Unmapped";
    companyMap[c] = (companyMap[c] ?? 0) + 1;
  }
  const topCompanies = Object.entries(companyMap)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // Reference identities/companies counts (used elsewhere)
  void identities;
  void companies;

  return {
    domains,
    totals: { total: domains.length, expiring30, expiring60, critical, noAutoRenew, unmapped },
    providerCounts,
    buckets,
    recent,
    criticalReports,
    topCompanies,
    fetchedAt: new Date().toISOString(),
    errors,
  };
});
