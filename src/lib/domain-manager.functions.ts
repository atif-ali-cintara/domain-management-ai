import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { fixBrandCasing } from "@/lib/dmd/brand";
import { SHEET_DOMAINS } from "@/lib/dmd/domain-sheet";

export type ManagedDomain = {
  domain: string;
  registrar: "GoDaddy" | "Namecheap" | "101domains";
  accountUsername: string;
  accountName: string;
  contactEmail: string | null;
  expires: string | null;
  expiresInDays: number | null;
  status: string;
  autoRenew: boolean;
  privacy?: boolean;
  importance?: string;
  category?: string;
  source?: "api" | "sheet";
};

export type DomainManagerResult = {
  domains: ManagedDomain[];
  accounts: { registrar: string; account: string; ok: boolean; count: number; message?: string }[];
  fetchedAt: string;
};

// Namecheap accounts that Namecheap hasn't granted API access to (spend threshold not met).
// Listed so they're tracked in Domain Manager; their domains can't be pulled automatically.
const NAMECHEAP_NO_API: { domain: string; username: string }[] = [
  { domain: "revxhomeservices.com", username: "subtainrevX" },
  { domain: "peopleamplify.com", username: "abdullahr98" },
  { domain: "betterpeoplesupport.com", username: "aliraza908" },
  { domain: "growthrethink.com", username: "maheenfaisal2f" },
  { domain: "trackinglinktech.com", username: "kamranmalik22" },
  { domain: "Hownerly Nexa", username: "muhammaddanish33789" },
  { domain: "curbnexa.com", username: "Iqraworkspace" },
  { domain: "Hearth Vero", username: "rabiaimran5424" },
  { domain: "curblymint.com", username: "kalsoom538452" },
];

let cache: { at: number; data: DomainManagerResult } | null = null;
const TTL = 10 * 60_000;

async function mapLimit<T, R>(items: T[], n: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (i < items.length) {
        const idx = i++;
        out[idx] = await fn(items[idx]);
      }
    }),
  );
  return out;
}

const days = (iso: string | null) =>
  iso ? Math.round((new Date(iso).getTime() - Date.now()) / 86_400_000) : null;

async function loadGoDaddyAccount(
  key: string,
  secret: string,
  account: string,
  acc: DomainManagerResult["accounts"],
): Promise<ManagedDomain[]> {
  const headers = { Authorization: `sso-key ${key}:${secret}`, Accept: "application/json" };
  const list: any[] = [];
  try {
    let marker: string | undefined;
    for (let p = 0; p < 20; p++) {
      const u = new URL("https://api.godaddy.com/v1/domains");
      u.searchParams.set("limit", "1000");
      if (marker) u.searchParams.set("marker", marker);
      const r = await fetch(u, { headers });
      if (!r.ok) throw new Error(`HTTP ${r.status}: ${(await r.text()).slice(0, 150)}`);
      const b = (await r.json()) as any[];
      if (!b.length) break;
      list.push(...b);
      if (b.length < 1000) break;
      marker = b[b.length - 1].domain;
    }
  } catch (e) {
    acc.push({ registrar: "GoDaddy", account, ok: false, count: 0, message: (e as Error).message });
    return [];
  }
  let emailFails = 0;
  const out = await mapLimit(list, 5, async (g) => {
    let email: string | null = null;
    try {
      const r = await fetch(`https://api.godaddy.com/v1/domains/${g.domain}`, { headers });
      if (r.ok) {
        const d = (await r.json()) as any;
        email = d?.contactRegistrant?.email ?? d?.contactAdmin?.email ?? null;
      } else emailFails++;
    } catch {
      emailFails++;
    }
    const expires = g.expires ?? null;
    return {
      domain: g.domain,
      registrar: "GoDaddy" as const,
      accountUsername: account,
      accountName: account,
      contactEmail: email,
      expires,
      expiresInDays: days(expires),
      status: g.status ?? "UNKNOWN",
      autoRenew: !!g.renewAuto,
    };
  });
  acc.push({
    registrar: "GoDaddy",
    account,
    ok: true,
    count: out.length,
    message: emailFails ? `Contact email unavailable for ${emailFails} domains` : undefined,
  });
  return out;
}

async function loadGoDaddy(acc: DomainManagerResult["accounts"]): Promise<ManagedDomain[]> {
  const e = process.env;
  const creds: { key: string; secret: string; name: string }[] = [];
  if (e.GODADDY_API_KEY && e.GODADDY_API_SECRET)
    creds.push({ key: e.GODADDY_API_KEY, secret: e.GODADDY_API_SECRET, name: fixBrandCasing(e.GODADDY_ACCOUNT_NAME || "GoDaddy Main") });
  for (let n = 2; n <= 20; n++) {
    const k = e[`GODADDY_API_KEY_${n}`];
    const s = e[`GODADDY_API_SECRET_${n}`];
    if (k && s) creds.push({ key: k, secret: s, name: fixBrandCasing(e[`GODADDY_ACCOUNT_NAME_${n}`] || `GoDaddy Account ${n}`) });
  }
  if (!creds.length) {
    acc.push({ registrar: "GoDaddy", account: "—", ok: false, count: 0, message: "Not connected" });
    return [];
  }
  const res = await Promise.all(creds.map((c) => loadGoDaddyAccount(c.key, c.secret, c.name, acc)));
  return res.flat();
}

function attrs(s: string) {
  const o: Record<string, string> = {};
  const re = /(\w+)="([^"]*)"/g;
  let m;
  while ((m = re.exec(s))) o[m[1]] = m[2];
  return o;
}
function ncDate(d?: string) {
  if (!d) return null;
  const [mm, dd, yy] = d.split("/");
  return mm && dd && yy ? `${yy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}T00:00:00Z` : null;
}

async function loadNamecheapAccount(
  apiUser: string,
  apiKey: string,
  ip: string,
  acc: DomainManagerResult["accounts"],
  name: string = apiUser,
): Promise<ManagedDomain[]> {
  const base = (cmd: string) => {
    const u = new URL("https://api.namecheap.com/xml.response");
    u.searchParams.set("ApiUser", apiUser);
    u.searchParams.set("ApiKey", apiKey);
    u.searchParams.set("UserName", apiUser);
    u.searchParams.set("ClientIp", ip);
    u.searchParams.set("Command", cmd);
    return u;
  };
  const rows: Record<string, string>[] = [];
  try {
    for (let page = 1; page <= 20; page++) {
      const u = base("namecheap.domains.getList");
      u.searchParams.set("PageSize", "100");
      u.searchParams.set("Page", String(page));
      const t = await (await fetch(u)).text();
      if (/Status\s*=\s*["']ERROR["']/i.test(t)) {
        const err = /<Error[^>]*>([^<]+)<\/Error>/i.exec(t)?.[1] ?? "API error";
        throw new Error(`${err} (server address ${ip})`);
      }
      const batch = [...t.matchAll(/<Domain\b([^>]*?)\/?>/g)].map((m) => attrs(m[1])).filter((a) => a.Name);
      rows.push(...batch);
      if (batch.length < 100) break;
    }
  } catch (e) {
    acc.push({ registrar: "Namecheap", account: name, ok: false, count: 0, message: (e as Error).message });
    return [];
  }
  const out = await mapLimit(rows, 3, async (a) => {
    let email: string | null = null;
    try {
      const u = base("namecheap.domains.getContacts");
      u.searchParams.set("DomainName", a.Name);
      const t = await (await fetch(u)).text();
      const reg = /<Registrant\b[^>]*>([\s\S]*?)<\/Registrant>/i.exec(t)?.[1] ?? t;
      email = /<EmailAddress>([^<]*)<\/EmailAddress>/i.exec(reg)?.[1]?.trim() || null;
    } catch {
      /* ignore */
    }
    const expires = ncDate(a.Expires);
    return {
      domain: a.Name,
      registrar: "Namecheap" as const,
      accountUsername: apiUser,
      accountName: name,
      contactEmail: email,
      expires,
      expiresInDays: days(expires),
      status: a.IsExpired === "true" ? "EXPIRED" : a.IsLocked === "true" ? "LOCKED" : "ACTIVE",
      autoRenew: a.AutoRenew === "true",
    };
  });
  acc.push({ registrar: "Namecheap", account: name, ok: true, count: out.length });
  return out;
}

async function loadNamecheap(acc: DomainManagerResult["accounts"]) {
  const creds: [string, string, string][] = [];
  const e = process.env;
  if (e.NAMECHEAP_API_USER && e.NAMECHEAP_API_KEY) creds.push([e.NAMECHEAP_API_USER, e.NAMECHEAP_API_KEY, fixBrandCasing(e.NAMECHEAP_ACCOUNT_NAME || e.NAMECHEAP_API_USER)]);
  for (let n = 2; n <= 20; n++) {
    const u = e[`NAMECHEAP_API_USER_${n}`];
    const k = e[`NAMECHEAP_API_KEY_${n}`];
    if (u && k) creds.push([u, k, fixBrandCasing(e[`NAMECHEAP_ACCOUNT_NAME_${n}`] || u)]);
  }
  if (!creds.length) {
    acc.push({ registrar: "Namecheap", account: "—", ok: false, count: 0, message: "Not connected" });
    return [];
  }
  let ip = "127.0.0.1";
  try {
    ip = ((await (await fetch("https://api.ipify.org?format=json")).json()) as { ip: string }).ip;
  } catch {
    /* ignore */
  }
  const res = await Promise.all(creds.map(([u, k, nm]) => loadNamecheapAccount(u, k, ip, acc, nm)));
  return res.flat();
}

export const getManagedDomains = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { refresh?: boolean } | undefined) => d ?? ({} as { refresh?: boolean }))
  .handler(async ({ data }): Promise<DomainManagerResult> => {
    if (!data.refresh && cache && Date.now() - cache.at < TTL) return cache.data;
    const accounts: DomainManagerResult["accounts"] = [];
    const [gd, nc] = await Promise.all([loadGoDaddy(accounts), loadNamecheap(accounts)]);
    for (const a of NAMECHEAP_NO_API) {
      accounts.push({
        registrar: "Namecheap",
        account: `Namecheap - ${a.domain} (${a.username})`,
        ok: false,
        count: 0,
        message: "No API access — Namecheap spend threshold not met",
      });
    }
    const live = new Map<string, ManagedDomain>();
    for (const d of [...nc, ...gd]) {
      const k = d.domain.toLowerCase();
      if (!live.has(k)) live.set(k, { ...d, source: "api" });
    }
    const added: ManagedDomain[] = [];
    let oneCount = 0;
    for (const s of SHEET_DOMAINS) {
      const ex = live.get(s.domain);
      const accountName = fixBrandCasing(s.accountName || s.username || s.registrar);
      if (ex) {
        ex.importance ??= s.importance ?? undefined;
        ex.category ??= s.category ?? undefined;
        ex.privacy ??= s.privacy ?? undefined;
        ex.contactEmail ??= s.email;
        continue;
      }
      if (s.registrar === "101domains") oneCount++;
      const expires = s.expires ? new Date(s.expires + "T00:00:00Z").toISOString() : null;
      added.push({
        domain: s.domain,
        registrar: s.registrar,
        accountUsername: s.username || "—",
        accountName,
        contactEmail: s.email,
        expires,
        expiresInDays: days(expires),
        status: s.status.toUpperCase(),
        autoRenew: !!s.autoRenew,
        privacy: s.privacy ?? undefined,
        importance: s.importance ?? undefined,
        category: s.category ?? undefined,
        source: "sheet",
      });
    }
    accounts.push({
      registrar: "101domains",
      account: "101domain - Main AI Domains (bill@twiceverified.com)",
      ok: false,
      count: oneCount,
      message: `${oneCount} domains added from your sheet — no API key yet`,
    });
    const domains = [...live.values(), ...added];
    const result = { domains, accounts, fetchedAt: new Date().toISOString() };
    cache = { at: Date.now(), data: result };
    return result;
  });
