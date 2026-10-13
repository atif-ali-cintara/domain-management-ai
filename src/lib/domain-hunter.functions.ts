import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const IterationInput = z.object({
  prompt: z.string().min(1).max(4000),
  iteration: z.number().int().min(1).max(50),
  history: z
    .array(
      z.object({
        domain: z.string(),
        available: z.boolean().nullable(),
        price: z.number().nullable().optional(),
        error: z.string().nullable().optional(),
      })
    )
    .max(2000),
  tlds: z.array(z.string()).min(1).max(60).default([".com"]),
  branchName: z.string().max(80).optional(),
  branchKeywords: z.array(z.string().max(40)).max(20).optional(),
  branchDescription: z.string().max(300).optional(),
  batchSize: z.number().int().min(1).max(20).default(10),
  maxLength: z.number().int().min(5).max(40).optional(),
  inspiration: z.string().max(2000).optional(),
});

const MapBranchesInput = z.object({
  prompt: z.string().min(1).max(4000),
  count: z.number().int().min(3).max(10).default(6),
  inspiration: z.string().max(2000).optional(),
});

type DomainResult = {
  domain: string;
  available: boolean | null;
  price: number | null;
  currency?: string | null;
  error?: string | null;
  source?: "namecheap" | "dns" | "registry";
  note?: string;
  likely?: boolean;
};

export type Branch = {
  id: string;
  name: string;
  description: string;
  keywords: string[];
};

async function deepseekJSON(system: string, user: string, temperature = 1.0): Promise<unknown> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature,
      response_format: { type: "json_object" },
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`AI gateway ${res.status}: ${t.slice(0, 200)}`);
  }
  const data = await res.json();
  const content: string = data.choices?.[0]?.message?.content ?? "";
  try {
    return JSON.parse(content);
  } catch {
    const m = content.match(/[\[{][\s\S]*[\]}]/);
    if (m) return JSON.parse(m[0]);
    return null;
  }
}

async function generateIdeas(
  prompt: string,
  iteration: number,
  history: { domain: string; available: boolean | null }[],
  tlds: string[],
  batchSize: number,
  branch?: { name: string; description?: string; keywords?: string[] },
  inspiration?: string
): Promise<string[]> {
  const available = history.filter((h) => h.available === true).map((h) => h.domain);
  const taken = history.filter((h) => h.available === false).map((h) => h.domain);

  const sys = `You are an expert domain-name brainstormer. Generate creative, short, memorable, brandable domain names that STRICTLY match the user's brief. Every idea MUST be clearly and directly relevant to the brief's industry, audience, and intent — reject any name that could apply to an unrelated business. Reply with ONLY a JSON object like {"domains":["foo.com","bar.io"]}. Lowercase. Include TLD.

CRITICAL CREATIVITY RULES (the obvious .com space is almost always taken — do NOT waste ideas on it):
- Prefer HYBRID / INVENTED / COMPOUND stems: portmanteaus, invented brand words, Latin/Greek/French roots, playful suffixes (-ly, -ify, -ora, -ora, -vera, -eon, -ora, -ora, -ux, -io-style but as letters), and unexpected metaphors.
- US state/metro codes in the brief (HI, CA, NY, CO, ME, MD, VA, FL, etc.) are PREFIX or SUFFIX HINTS ONLY — never treat them as TLDs and never output them as ".hi" / ".ca" / ".me" / ".co". Combine them into the stem (e.g. "cavantahomes", "flkeyoffer", "nycasadeed").
- Avoid the most crowded exact patterns unless combined with an invented twist: bare "webuyhomes*", "*homes", "home*buyers", "cash*offer", "sell*fast", "we*pay*cash".
- Names must feel trustworthy and corporate for a US home-buying company, but still be distinctive.`;


  const branchBlock = branch
    ? `\nSEMANTIC BRANCH: ${branch.name}\nBranch angle: ${branch.description ?? ""}\nBranch keywords/seeds: ${(branch.keywords ?? []).join(", ")}\nAll ideas MUST stay tightly within this branch's theme and feel.\n`
    : "";
  const inspirationBlock = inspiration && inspiration.trim()
    ? `\nINSPIRATION (keywords or example domains the user likes — emulate their feel, sound, length, and style, but DO NOT copy them verbatim):\n${inspiration.trim()}\n`
    : "";

  const user = `User brief: ${prompt}${branchBlock}${inspirationBlock}
Iteration: ${iteration}
TLDs to consider: ${tlds.join(", ")}
Already tried & AVAILABLE (vary similarly): ${available.slice(-20).join(", ") || "none"}
Already tried & TAKEN (avoid these and very-similar): ${taken.slice(-50).join(", ") || "none"}

RELEVANCE IS MANDATORY: every domain must instantly read as belonging to the brief above. Do not produce generic tech/startup names that could sell any product — they must evoke the specific industry, audience, or value described in the brief${branch ? " AND the semantic branch" : ""}. If a name isn't obviously on-brief, discard it and generate another.

Generate ${batchSize} NEW domain ideas that DO NOT appear in the history above. Be creative: invented words, compound words, metaphors, foreign-language roots, intentional misspellings — but stay ON-BRIEF. Keep names 4-14 chars before TLD. Return JSON only.`;

  const parsed = await deepseekJSON(sys, user, 1.2);
  let arr: unknown;
  if (Array.isArray(parsed)) arr = parsed;
  else if (parsed && typeof parsed === "object") {
    const obj = parsed as Record<string, unknown>;
    arr = obj.domains ?? obj.ideas ?? Object.values(obj).find((v) => Array.isArray(v));
  }
  if (!Array.isArray(arr)) return [];
  const seen = new Set(history.map((h) => h.domain.toLowerCase()));
  return Array.from(
    new Set(
      arr
        .filter((x): x is string => typeof x === "string")
        .map((s) => s.trim().toLowerCase())
        .filter((s) => /^[a-z0-9-]+\.[a-z.]+$/.test(s))
        .filter((s) => !seen.has(s))
    )
  ).slice(0, batchSize);
}

const RDAP_HEADERS = {
  Accept: "application/rdap+json, application/json",
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
};

const DIRECT_RDAP: Record<string, string> = {
  com: "https://rdap.verisign.com/com/v1/",
  net: "https://rdap.verisign.com/net/v1/",
};

let ianaCache: Promise<Record<string, string>> | null = null;
function ianaBootstrap(): Promise<Record<string, string>> {
  if (!ianaCache) {
    ianaCache = fetch("https://data.iana.org/rdap/dns.json", { headers: RDAP_HEADERS })
      .then((r) => (r.ok ? r.json() : { services: [] }))
      .then((j: { services?: [string[], string[]][] }) => {
        const map: Record<string, string> = {};
        for (const [tlds, urls] of j.services ?? []) {
          const url = urls.find((u) => u.startsWith("https")) ?? urls[0];
          if (!url) continue;
          for (const t of tlds) map[t.toLowerCase()] = url.endsWith("/") ? url : url + "/";
        }
        return map;
      })
      .catch(() => {
        ianaCache = null;
        return {};
      });
  }
  return ianaCache;
}

async function rdapBase(domain: string): Promise<string> {
  const tld = domain.split(".").slice(1).join(".").toLowerCase();
  const last = domain.split(".").pop()!.toLowerCase();
  if (DIRECT_RDAP[last]) return DIRECT_RDAP[last];
  const map = await ianaBootstrap();
  return map[tld] ?? map[last] ?? "https://rdap.org/";
}

async function rdapOnce(domain: string, base: string): Promise<{ status: number } | { networkError: string }> {
  try {
    const res = await fetch(`${base}domain/${encodeURIComponent(domain)}`, {
      headers: RDAP_HEADERS,
      redirect: "follow",
    });
    return { status: res.status };
  } catch (e) {
    return { networkError: e instanceof Error ? e.message : "Network error" };
  }
}

// DNS-over-HTTPS: active NS records => definitely registered.
async function dnsCheck(domain: string): Promise<"taken" | "nxdomain" | "unknown"> {
  try {
    const res = await fetch(
      `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(domain)}&type=NS`,
      { headers: { Accept: "application/dns-json" } }
    );
    if (!res.ok) return "unknown";
    const j = (await res.json()) as { Status?: number; Answer?: unknown[]; Authority?: unknown[] };
    if (j.Status === 3) return "nxdomain";
    if (j.Status === 0 && Array.isArray(j.Answer) && j.Answer.length > 0) return "taken";
    return "unknown";
  } catch {
    return "unknown";
  }
}

async function rdapCheck(domain: string, attempts: number): Promise<DomainResult> {
  let base = await rdapBase(domain);
  let lastErr = "Unknown";
  for (let i = 0; i < attempts; i++) {
    const r = await rdapOnce(domain, base);
    if ("networkError" in r) {
      lastErr = r.networkError;
    } else if (r.status === 404) {
      return { domain, available: true, price: null, currency: "USD", source: "registry" };
    } else if (r.status === 200) {
      return { domain, available: false, price: null, currency: "USD", source: "registry" };
    } else if (r.status === 429 || r.status >= 500) {
      lastErr = `RDAP ${r.status}`;
    } else {
      lastErr = `RDAP ${r.status}`;
      if (base !== "https://rdap.org/") base = "https://rdap.org/";
      else break;
    }
    if (i < attempts - 1) {
      const delay = 400 * Math.pow(2, i) + Math.floor(Math.random() * 250);
      await new Promise((res) => setTimeout(res, delay));
    }
  }
  return { domain, available: null, price: null, error: lastErr };
}

// Fallback when Namecheap can't answer: DNS first, then registry.
async function fallbackCheck(domain: string, attempts: number, note?: string): Promise<DomainResult> {
  const dns = await dnsCheck(domain);
  if (dns === "taken") return { domain, available: false, price: null, currency: "USD", source: "dns", note };
  const r = await rdapCheck(domain, attempts);
  if (r.available !== null) return { ...r, note };
  if (dns === "nxdomain") return { domain, available: true, price: null, currency: "USD", source: "dns", note, likely: true };
  return { ...r, note };
}

async function egressIp(): Promise<string> {
  try {
    const r = await fetch("https://api.ipify.org?format=json");
    const j = (await r.json()) as { ip?: string };
    return j.ip ?? "0.0.0.0";
  } catch {
    return "0.0.0.0";
  }
}

// Namecheap domains.check — authoritative availability + premium pricing.
async function namecheapCheck(
  domains: string[]
): Promise<{ results: Map<string, DomainResult>; issue?: string }> {
  const results = new Map<string, DomainResult>();
  const user = process.env.NAMECHEAP_API_USER;
  const key = process.env.NAMECHEAP_API_KEY;
  if (!user || !key || domains.length === 0) return { results, issue: user && key ? undefined : "Namecheap not configured" };
  const ip = await egressIp();
  for (let i = 0; i < domains.length; i += 50) {
    const chunk = domains.slice(i, i + 50);
    const url = new URL("https://api.namecheap.com/xml.response");
    url.search = new URLSearchParams({
      ApiUser: user, ApiKey: key, UserName: user, ClientIp: ip,
      Command: "namecheap.domains.check", DomainList: chunk.join(","),
    }).toString();
    let xml = "";
    try {
      xml = await (await fetch(url.toString())).text();
    } catch (e) {
      return { results, issue: `Namecheap unreachable: ${e instanceof Error ? e.message : "network"}` };
    }
    if (/Status="ERROR"/i.test(xml)) {
      const msg = xml.match(/<Error[^>]*>([^<]*)<\/Error>/i)?.[1]?.trim() ?? "error";
      const ipIssue = /IP|1011150/i.test(msg);
      return { results, issue: ipIssue ? `Namecheap: whitelist IP ${ip}` : `Namecheap: ${msg}` };
    }
    for (const m of xml.matchAll(/<DomainCheckResult\b([^>]*)\/?>/gi)) {
      const attrs: Record<string, string> = {};
      for (const a of m[1].matchAll(/(\w+)="([^"]*)"/g)) attrs[a[1].toLowerCase()] = a[2];
      const d = attrs.domain?.toLowerCase();
      if (!d) continue;
      const premium = attrs.ispremiumname === "true";
      const pp = Number(attrs.premiumregistrationprice);
      results.set(d, {
        domain: d,
        available: attrs.available === "true",
        price: premium && pp > 0 ? pp : null,
        currency: "USD",
        source: "namecheap",
      });
    }
  }
  return { results };
}

async function checkMany(domains: string[], attempts = 3): Promise<{ results: DomainResult[]; issue?: string }> {
  const nc = await namecheapCheck(domains);
  const results = await mapWithConcurrency(domains, 4, (d) => {
    const hit = nc.results.get(d.toLowerCase());
    return hit ? Promise.resolve(hit) : fallbackCheck(d, attempts, nc.issue);
  });
  return { results, issue: nc.issue };
}

async function checkDomain(domain: string, attempts = 3): Promise<DomainResult> {
  return (await checkMany([domain], attempts)).results[0];
}

// Simple concurrency limiter — RDAP starts throwing 429 when we blast 10+ parallel
// requests, so keep it at 4 in flight and it stays happy.
async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const idx = cursor++;
      if (idx >= items.length) return;
      out[idx] = await fn(items[idx]);
    }
  });
  await Promise.all(workers);
  return out;
}

export const runIteration = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => IterationInput.parse(d))
  .handler(async ({ data }) => {
    const branch = data.branchName
      ? { name: data.branchName, description: data.branchDescription, keywords: data.branchKeywords }
      : undefined;
    const ideas = await generateIdeas(
      data.prompt,
      data.iteration,
      data.history,
      data.tlds,
      data.batchSize,
      branch,
      data.inspiration
    );
    if (ideas.length === 0) {
      return { ideas, results: [] as DomainResult[] };
    }
    const { results } = await checkMany(ideas);
    return { ideas, results };
  });

const RecheckInput = z.object({
  domain: z.string().min(3).max(255).regex(/^[a-z0-9-]+\.[a-z.]+$/i),
});

export const recheckDomain = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => RecheckInput.parse(d))
  .handler(async ({ data }) => {
    const result = await checkDomain(data.domain.toLowerCase(), 4);
    return { result };
  });


export const mapBranches = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => MapBranchesInput.parse(d))
  .handler(async ({ data }) => {
    const sys = `You are a brand strategist. Given a brief, produce distinct semantic branches (positioning angles) for domain brainstorming. Reply ONLY with JSON: {"branches":[{"name":"...","description":"...","keywords":["..."]}]}`;
    const inspirationBlock = data.inspiration && data.inspiration.trim()
      ? `\n\nINSPIRATION (keywords or example domains the user likes — let these influence the tone, sound, and style of the branches you produce):\n${data.inspiration.trim()}`
      : "";
    const user = `Brief: ${data.prompt}${inspirationBlock}

Produce ${data.count} DISTINCT semantic branches. Each branch represents a different brand angle/positioning (e.g. "Trust & Reliability", "Speed & On-demand", "Local/Neighborhood", "Premium/Luxury", "Playful/Friendly", "Eco/Green", "Tech-forward"). For each branch:
- name: 2-4 word label
- description: one sentence on the angle/feel
- keywords: 6-10 seed words/roots/metaphors to inspire domain names in this branch

Branches should be meaningfully different from each other. Return JSON only.`;
    const parsed = await deepseekJSON(sys, user, 0.9);
    let arr: unknown;
    if (parsed && typeof parsed === "object") {
      const obj = parsed as Record<string, unknown>;
      arr = obj.branches ?? Object.values(obj).find((v) => Array.isArray(v));
    }
    if (!Array.isArray(arr)) return { branches: [] as Branch[] };
    const branches: Branch[] = arr
      .filter((x): x is Record<string, unknown> => !!x && typeof x === "object")
      .map((b, i) => ({
        id: `b${i}-${String(b.name ?? "").toString().toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 24) || i}`,
        name: String(b.name ?? `Branch ${i + 1}`).slice(0, 80),
        description: String(b.description ?? "").slice(0, 300),
        keywords: Array.isArray(b.keywords)
          ? (b.keywords as unknown[])
              .filter((k): k is string => typeof k === "string")
              .map((k) => k.trim())
              .filter(Boolean)
              .slice(0, 12)
          : [],
      }))
      .slice(0, data.count);
    return { branches };
  });

const SuggestTldsInput = z.object({
  prompt: z.string().max(4000).optional(),
  query: z.string().max(200).optional(),
  exclude: z.array(z.string()).max(200).optional(),
  count: z.number().int().min(3).max(20).default(10),
});

export type SuggestedTld = { tld: string; avg: number; reason?: string };

export const suggestTlds = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => SuggestTldsInput.parse(d))
  .handler(async ({ data }) => {
    if (!data.prompt?.trim() && !data.query?.trim()) {
      return { tlds: [] as SuggestedTld[] };
    }
    const sys = `You are a domain TLD expert. Given a brief and/or search query, suggest the most relevant real, registrable top-level domains (gTLDs, ccTLDs used for branding, new gTLDs). Reply ONLY JSON: {"tlds":[{"tld":".xyz","avg":25,"reason":"..."}]}. Lowercase, include leading dot. "avg" is your best estimate of typical first-year USD registration price.`;
    const parts: string[] = [];
    if (data.prompt?.trim()) parts.push(`BRIEF:\n${data.prompt.trim()}`);
    if (data.query?.trim()) parts.push(`SEARCH QUERY (user is looking for TLDs matching this):\n${data.query.trim()}`);
    if (data.exclude && data.exclude.length)
      parts.push(`ALREADY KNOWN (do NOT include these): ${data.exclude.slice(0, 150).join(", ")}`);
    parts.push(
      `Return up to ${data.count} TLDs that are genuinely relevant. Prefer real, widely-registrable TLDs. Avoid obscure or restricted ones unless clearly relevant. Each "reason" should be 3-8 words.`
    );
    const parsed = await deepseekJSON(sys, parts.join("\n\n"), 0.7);
    let arr: unknown;
    if (parsed && typeof parsed === "object") {
      const obj = parsed as Record<string, unknown>;
      arr = obj.tlds ?? Object.values(obj).find((v) => Array.isArray(v));
    }
    if (!Array.isArray(arr)) return { tlds: [] as SuggestedTld[] };
    const seen = new Set((data.exclude ?? []).map((t) => t.toLowerCase()));
    const out: SuggestedTld[] = [];
    for (const item of arr) {
      if (!item || typeof item !== "object") continue;
      const o = item as Record<string, unknown>;
      let tld = typeof o.tld === "string" ? o.tld.trim().toLowerCase() : "";
      if (!tld) continue;
      if (!tld.startsWith(".")) tld = "." + tld;
      if (!/^\.[a-z]{2,}$/.test(tld)) continue;
      if (seen.has(tld)) continue;
      seen.add(tld);
      const avg = typeof o.avg === "number" && o.avg > 0 ? Math.round(o.avg) : 30;
      const reason = typeof o.reason === "string" ? o.reason.slice(0, 80) : undefined;
      out.push({ tld, avg, reason });
      if (out.length >= data.count) break;
    }
    return { tlds: out };
  });
