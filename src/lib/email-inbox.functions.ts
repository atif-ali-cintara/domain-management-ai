import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type Mailbox = {
  email: string;
  company_name: string | null;
  connected: boolean;
  status: string | null;
  last_synced_at: string | null;
  last_error: string | null;
};

export type InboxMessage = {
  id: string;
  mailbox: string;
  sender: string | null;
  subject: string | null;
  snippet: string | null;
  received_at: string | null;
  category: string;
  summary: string | null;
  action_required: string | null;
  is_read: boolean;
  is_pinned: boolean;
};

async function assertSuperAdmin(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "super_admin" });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: admin only");
}

export const listMailboxes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Mailbox[]> => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: creds }, { data: accts }] = await Promise.all([
      supabaseAdmin.from("account_credentials").select("account_email, company_name").eq("vendor", "G-Suite"),
      supabaseAdmin.from("email_accounts").select("email, company_name, status, last_synced_at, last_error, refresh_token_enc"),
    ]);
    const map = new Map<string, Mailbox>();
    for (const c of creds ?? []) {
      if (!c.account_email) continue;
      const e = c.account_email.trim().toLowerCase();
      map.set(e, { email: e, company_name: c.company_name, connected: false, status: null, last_synced_at: null, last_error: null });
    }
    for (const a of accts ?? []) {
      const prev = map.get(a.email);
      map.set(a.email, {
        email: a.email,
        company_name: prev?.company_name ?? a.company_name,
        connected: !!a.refresh_token_enc && a.status === "connected",
        status: a.status,
        last_synced_at: a.last_synced_at,
        last_error: a.last_error,
      });
    }
    return [...map.values()].sort((x, y) => x.email.localeCompare(y.email));
  });

export const startGmailConnect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ origin: z.string().url(), hint: z.string().email().nullable() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    const { isAllowedOrigin, signState, googleClient, redirectUri, GMAIL_SCOPES } = await import("./email-inbox.server");
    if (!isAllowedOrigin(data.origin)) throw new Error("Origin not allowed");
    const { id } = googleClient();
    const state = signState({ uid: context.userId, hint: data.hint, origin: data.origin, exp: Date.now() + 10 * 60_000 });
    const p = new URLSearchParams({
      client_id: id,
      redirect_uri: redirectUri(data.origin),
      response_type: "code",
      scope: GMAIL_SCOPES.join(" "),
      access_type: "offline",
      prompt: "consent select_account",
      include_granted_scopes: "true",
      state,
    });
    if (data.hint) p.set("login_hint", data.hint);
    return { url: `https://accounts.google.com/o/oauth2/v2/auth?${p}` };
  });

export const syncInboxes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { decryptSecret } = await import("./vault.server");
    const srv = await import("./email-inbox.server");
    const { data: accts } = await supabaseAdmin.from("email_accounts").select("*").eq("status", "connected");
    const results: { email: string; added: number; error?: string }[] = [];

    for (const a of accts ?? []) {
      try {
        const rt = decryptSecret(a.refresh_token_enc);
        if (!rt) throw new Error("Missing token — reconnect this mailbox");
        const token = await srv.refreshAccessToken(rt);
        const list: any = await srv.gmail(token, `/messages?q=${encodeURIComponent("is:unread")}&maxResults=50`);
        const ids: string[] = (list.messages ?? []).map((m: any) => m.id);

        const { data: existing } = await supabaseAdmin.from("email_messages").select("gmail_id").eq("account_id", a.id);
        const known = new Set((existing ?? []).map((e: any) => e.gmail_id));
        const fresh = ids.filter((i) => !known.has(i));

        // Messages no longer unread in Gmail → mark read (pinned ones stay visible)
        const unreadSet = new Set(ids);
        const readNow = [...known].filter((g) => !unreadSet.has(g));
        if (readNow.length) {
          await supabaseAdmin.from("email_messages").update({ is_read: true }).eq("account_id", a.id).in("gmail_id", readNow);
        }

        const metas = await Promise.all(
          fresh.map((id) =>
            srv.gmail(token, `/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`),
          ),
        );
        const preset: Record<string, string> = {};
        const toAi: { id: string; from: string; subject: string; snippet: string }[] = [];
        for (const m of metas) {
          const labels: string[] = m.labelIds ?? [];
          if (labels.includes("SPAM")) preset[m.id] = "junk";
          else if (labels.includes("CATEGORY_PROMOTIONS")) preset[m.id] = "promotion";
          else toAi.push({ id: m.id, from: srv.header(m, "From"), subject: srv.header(m, "Subject"), snippet: m.snippet ?? "" });
        }
        const ai = new Map((await srv.classifyEmails(toAi)).map((r) => [r.id, r]));
        const rows = metas.map((m) => {
          const c = ai.get(m.id);
          return {
            account_id: a.id,
            gmail_id: m.id,
            thread_id: m.threadId,
            sender: srv.header(m, "From"),
            subject: srv.header(m, "Subject"),
            snippet: m.snippet ?? "",
            received_at: m.internalDate ? new Date(Number(m.internalDate)).toISOString() : null,
            category: preset[m.id] ?? c?.category ?? "informational",
            summary: c?.summary ?? (m.snippet ?? "").slice(0, 160),
            action_required: preset[m.id] ? "None" : (c?.action_required ?? "Review"),
          };
        });
        if (rows.length) await supabaseAdmin.from("email_messages").upsert(rows, { onConflict: "account_id,gmail_id" });
        await supabaseAdmin.from("email_accounts").update({ last_synced_at: new Date().toISOString(), last_error: null }).eq("id", a.id);
        results.push({ email: a.email, added: rows.length });
      } catch (e: any) {
        await supabaseAdmin.from("email_accounts").update({ last_error: String(e.message).slice(0, 500) }).eq("id", a.id);
        results.push({ email: a.email, added: 0, error: e.message });
      }
    }
    return results;
  });

export const listInboxMessages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<InboxMessage[]> => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("email_messages")
      .select("id, sender, subject, snippet, received_at, category, summary, action_required, is_read, is_pinned, email_accounts(email)")
      .eq("dismissed", false)
      .or("is_read.eq.false,is_pinned.eq.true")
      .order("received_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    return (data ?? []).map((r: any) => ({
      id: r.id,
      mailbox: r.email_accounts?.email ?? "",
      sender: r.sender,
      subject: r.subject,
      snippet: r.snippet,
      received_at: r.received_at,
      category: r.category,
      summary: r.summary,
      action_required: r.action_required,
      is_read: r.is_read,
      is_pinned: r.is_pinned,
    }));
  });

export const openInboxMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { decryptSecret } = await import("./vault.server");
    const srv = await import("./email-inbox.server");
    const { data: row, error } = await supabaseAdmin
      .from("email_messages")
      .select("gmail_id, account_id, email_accounts(refresh_token_enc)")
      .eq("id", data.id)
      .single();
    if (error || !row) throw new Error("Message not found");
    const rt = decryptSecret((row as any).email_accounts?.refresh_token_enc);
    if (!rt) throw new Error("Mailbox not connected");
    const token = await srv.refreshAccessToken(rt);
    const msg: any = await srv.gmail(token, `/messages/${row.gmail_id}?format=full`);
    await srv.gmail(token, `/messages/${row.gmail_id}/modify`, {
      method: "POST",
      body: JSON.stringify({ removeLabelIds: ["UNREAD"] }),
    });
    await supabaseAdmin.from("email_messages").update({ is_read: true }).eq("id", data.id);
    const body = srv.extractBody(msg.payload);
    return {
      from: srv.header(msg, "From"),
      to: srv.header(msg, "To"),
      subject: srv.header(msg, "Subject"),
      date: srv.header(msg, "Date"),
      html: body.html,
      text: body.text ?? msg.snippet ?? "",
    };
  });

export const updateInboxMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ id: z.string().uuid(), is_pinned: z.boolean().optional(), dismissed: z.boolean().optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const patch: Record<string, boolean> = {};
    if (data.is_pinned !== undefined) patch.is_pinned = data.is_pinned;
    if (data.dismissed !== undefined) patch.dismissed = data.dismissed;
    const { error } = await supabaseAdmin.from("email_messages").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const disconnectMailbox = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ email: z.string().email() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("email_accounts").update({ status: "disconnected", refresh_token_enc: null }).eq("email", data.email);
    return { ok: true };
  });
