import { createFileRoute } from "@tanstack/react-router";

function back(origin: string, params: Record<string, string>) {
  const u = new URL("/consolidated-email", origin);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  return Response.redirect(u.toString(), 302);
}

export const Route = createFileRoute("/api/public/google/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const srv = await import("@/lib/email-inbox.server");
        const state = srv.verifyState(url.searchParams.get("state") ?? "");
        if (!state) return new Response("Invalid or expired state", { status: 400 });
        const err = url.searchParams.get("error");
        if (err) return back(state.origin, { connect_error: err });
        const code = url.searchParams.get("code");
        if (!code) return back(state.origin, { connect_error: "missing_code" });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        // Re-verify the initiating user is still a super admin.
        const { data: role } = await supabaseAdmin
          .from("user_roles")
          .select("role")
          .eq("user_id", state.uid)
          .eq("role", "super_admin")
          .maybeSingle();
        if (!role) return new Response("Forbidden", { status: 403 });

        try {
          const { id, secret } = srv.googleClient();
          const tokRes = await fetch("https://oauth2.googleapis.com/token", {
            method: "POST",
            headers: { "content-type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
              code,
              client_id: id,
              client_secret: secret,
              redirect_uri: srv.redirectUri(state.origin),
              grant_type: "authorization_code",
            }),
          });
          const tok: any = await tokRes.json();
          if (!tokRes.ok) throw new Error(tok.error_description || tok.error || "token_exchange_failed");
          if (!tok.refresh_token) throw new Error("No refresh token returned — remove app access in Google account and retry");
          const profile: any = await srv.gmail(tok.access_token, "/profile");
          const email = String(profile.emailAddress).toLowerCase();

          const { encryptSecret } = await import("@/lib/vault.server");
          const { data: cred } = await supabaseAdmin
            .from("account_credentials")
            .select("company_name")
            .ilike("account_email", email)
            .limit(1)
            .maybeSingle();
          const { error } = await supabaseAdmin.from("email_accounts").upsert(
            {
              email,
              company_name: cred?.company_name ?? null,
              refresh_token_enc: encryptSecret(tok.refresh_token),
              status: "connected",
              last_error: null,
              connected_by: state.uid,
            },
            { onConflict: "email" },
          );
          if (error) throw new Error(error.message);
          return back(state.origin, { connected: email });
        } catch (e: any) {
          console.error("Gmail connect failed", e);
          return back(state.origin, { connect_error: String(e.message).slice(0, 200) });
        }
      },
    },
  },
});
