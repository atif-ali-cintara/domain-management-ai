// Server-only Gmail helpers for Consolidated Email Communication.
import { createHmac, timingSafeEqual } from "crypto";

export const EMAIL_CATEGORIES = [
  "critical",
  "important",
  "informational",
  "not-important",
  "promotion",
  "junk",
] as const;
export type EmailCategory = (typeof EMAIL_CATEGORIES)[number];

export const GMAIL_SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/userinfo.email",
  "openid",
];

export function isAllowedOrigin(origin: string): boolean {
  try {
    const u = new URL(origin);
    if (u.hostname === "localhost") return true;
    return u.protocol === "https:" && (u.hostname.endsWith(".lovable.app") || u.hostname.endsWith(".lovableproject.com"));
  } catch {
    return false;
  }
}

function stateSecret() {
  const s = process.env.EMAIL_OAUTH_STATE_SECRET;
  if (!s) throw new Error("EMAIL_OAUTH_STATE_SECRET not configured");
  return s;
}

export type OAuthState = { uid: string; hint: string | null; origin: string; exp: number };

export function signState(state: OAuthState): string {
  const body = Buffer.from(JSON.stringify(state)).toString("base64url");
  const sig = createHmac("sha256", stateSecret()).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function verifyState(raw: string): OAuthState | null {
  const [body, sig] = raw.split(".");
  if (!body || !sig) return null;
  const expected = createHmac("sha256", stateSecret()).update(body).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const s = JSON.parse(Buffer.from(body, "base64url").toString()) as OAuthState;
    if (s.exp < Date.now() || !isAllowedOrigin(s.origin)) return null;
    return s;
  } catch {
    return null;
  }
}

export function googleClient() {
  const id = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const secret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  if (!id || !secret) throw new Error("Google OAuth client is not configured yet (GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET).");
  return { id, secret };
}

export function redirectUri(origin: string) {
  return `${origin}/api/public/google/callback`;
}

export async function refreshAccessToken(refreshToken: string): Promise<string> {
  const { id, secret } = googleClient();
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: id, client_secret: secret, refresh_token: refreshToken, grant_type: "refresh_token" }),
  });
  const j: any = await res.json();
  if (!res.ok) throw new Error(`Google token refresh failed [${res.status}]: ${j.error_description || j.error}`);
  return j.access_token as string;
}

export async function gmail(token: string, path: string, init?: RequestInit) {
  const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "content-type": "application/json", ...(init?.headers || {}) },
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Gmail API failed [${res.status}]: ${t.slice(0, 300)}`);
  }
  return res.json();
}

export function header(msg: any, name: string): string {
  const h = (msg.payload?.headers || []).find((x: any) => x.name?.toLowerCase() === name.toLowerCase());
  return h?.value ?? "";
}

function decodeB64(data: string) {
  return Buffer.from(data.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
}

export function extractBody(payload: any): { html: string | null; text: string | null } {
  let html: string | null = null;
  let text: string | null = null;
  const walk = (p: any) => {
    if (!p) return;
    if (p.mimeType === "text/html" && p.body?.data && !html) html = decodeB64(p.body.data);
    else if (p.mimeType === "text/plain" && p.body?.data && !text) text = decodeB64(p.body.data);
    (p.parts || []).forEach(walk);
  };
  walk(payload);
  return { html, text };
}

type ClassifyInput = { id: string; from: string; subject: string; snippet: string };
type ClassifyOut = { id: string; category: EmailCategory; summary: string; action_required: string };

export async function classifyEmails(items: ClassifyInput[]): Promise<ClassifyOut[]> {
  if (!items.length) return [];
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        {
          role: "system",
          content:
            "You triage business emails for a company that manages domains, registrar accounts and multiple companies. For each email return category (critical = security alerts, payment failures, domain expiry, legal deadlines, account lockouts; important = needs a reply or decision soon; informational = receipts, confirmations, updates; not-important = low value notifications; promotion = marketing; junk = spam/phishing), a one-sentence summary, and action_required (short imperative, or 'None').",
        },
        { role: "user", content: JSON.stringify(items) },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "classify",
            parameters: {
              type: "object",
              properties: {
                results: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      id: { type: "string" },
                      category: { type: "string", enum: [...EMAIL_CATEGORIES] },
                      summary: { type: "string" },
                      action_required: { type: "string" },
                    },
                    required: ["id", "category", "summary", "action_required"],
                  },
                },
              },
              required: ["results"],
            },
          },
        },
      ],
      tool_choice: { type: "function", function: { name: "classify" } },
    }),
  });
  if (!res.ok) {
    console.error("AI classify failed", res.status, await res.text());
    return items.map((i) => ({ id: i.id, category: "informational", summary: i.snippet.slice(0, 160), action_required: "Review" }));
  }
  const j: any = await res.json();
  try {
    const args = JSON.parse(j.choices[0].message.tool_calls[0].function.arguments);
    return args.results as ClassifyOut[];
  } catch {
    return items.map((i) => ({ id: i.id, category: "informational", summary: i.snippet.slice(0, 160), action_required: "Review" }));
  }
}
