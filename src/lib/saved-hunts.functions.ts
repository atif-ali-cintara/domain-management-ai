import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database, Json } from "@/integrations/supabase/types";

export const listSavedHunts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("saved_hunts")
      .select("id, name, share_token, updated_at")
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const loadSavedHunt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("saved_hunts").select("id, name, data, share_token").eq("id", data.id).single();
    if (error) throw new Error(error.message);
    return { id: row.id, name: row.name, share_token: row.share_token, data: JSON.stringify(row.data) };
  });

export const saveHunt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id?: string; name: string; data: string }) => {
    if (d.data.length > 5_000_000) throw new Error("Hunt is too large to save");
    return d;
  })
  .handler(async ({ data, context }) => {
    const payload = JSON.parse(data.data) as Json;
    const name = data.name.slice(0, 200) || "Hunt";
    if (data.id) {
      const { data: row, error } = await context.supabase
        .from("saved_hunts").update({ name, data: payload }).eq("id", data.id)
        .select("id, share_token").maybeSingle();
      if (error) throw new Error(error.message);
      if (row) return row;
    }
    const { data: row, error } = await context.supabase
      .from("saved_hunts").insert({ owner_id: context.userId, name, data: payload })
      .select("id, share_token").single();
    if (error) throw new Error(error.message);
    return row;
  });

export const setHuntSharing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; enabled: boolean }) => d)
  .handler(async ({ data, context }) => {
    let token: string | null = null;
    if (data.enabled) {
      const bytes = crypto.getRandomValues(new Uint8Array(24));
      token = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
    }
    const { data: row, error } = await context.supabase
      .from("saved_hunts").update({ share_token: token }).eq("id", data.id)
      .select("share_token").single();
    if (error) throw new Error(error.message);
    return { share_token: row.share_token };
  });

export const deleteSavedHunt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("saved_hunts").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getSharedHunt = createServerFn({ method: "GET" })
  .inputValidator((d: { token: string }) => ({ token: String(d.token).slice(0, 100) }))
  .handler(async ({ data }) => {
    const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
    const sb = createClient<Database>(process.env["SUPABASE_URL"]!, key, {
      auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
      global: {
        fetch: (input, init) => {
          const h = new Headers(init?.headers);
          if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
          h.set("apikey", key);
          return fetch(input, { ...init, headers: h });
        },
      },
    });
    const { data: rows, error } = await sb.rpc("get_shared_hunt", { _token: data.token });
    if (error) throw new Error("Could not load shared hunt");
    const row = rows?.[0];
    if (!row) return null;
    return { name: row.name, updated_at: row.updated_at, data: JSON.stringify(row.data) };
  });
