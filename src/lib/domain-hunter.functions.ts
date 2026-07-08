import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const IterationInput = z.object({
  prompt: z.string().min(1).max(500),
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
  inspiration: z.string().max(500).optional(),
});

const MapBranchesInput = z.object({
  prompt: z.string().min(1).max(500),
  count: z.number().int().min(3).max(10).default(6),
  inspiration: z.string().max(500).optional(),
});

type DomainResult = {
  domain: string;
  available: boolean | null;
  price: number | null;
  currency?: string | null;
  error?: string | null;
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

async function checkDomain(domain: string): Promise<DomainResult> {
  // RDAP is the free, keyless successor to WHOIS. 404 = available, 200 = registered.
  // Works from Cloudflare Workers with no auth. rdap.org routes to the correct
  // registry RDAP server per TLD.
  try {
    const res = await fetch(`https://rdap.org/domain/${encodeURIComponent(domain)}`, {
      headers: { Accept: "application/rdap+json" },
      redirect: "follow",
    });
    if (res.status === 404) {
      return { domain, available: true, price: null, currency: "USD" };
    }
    if (res.status === 200) {
      return { domain, available: false, price: null, currency: "USD" };
    }
    if (res.status === 429) {
      return { domain, available: null, price: null, error: "Rate limited by RDAP" };
    }
    // Some TLDs (rare) may not be covered by rdap.org — treat as unknown rather than lying.
    return {
      domain,
      available: null,
      price: null,
      error: `RDAP ${res.status}`,
    };
  } catch (e) {
    return {
      domain,
      available: null,
      price: null,
      error: e instanceof Error ? e.message : "Network error",
    };
  }
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
    const results = await Promise.all(ideas.map((d) => checkDomain(d)));
    return { ideas, results };
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
  prompt: z.string().max(500).optional(),
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
