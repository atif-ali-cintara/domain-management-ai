import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { emailDomainAllowed } from "./auth-config";

/**
 * Sign up a new user. Enforces the @cintara.ai / @revcloud.com email rule
 * server-side (the trusted boundary). Creates the auth user as confirmed,
 * a profile row, and grants `super_admin` to the very first signup so the
 * platform always has exactly one owner without manual SQL.
 */
export const signUpWithDomainCheck = createServerFn({ method: "POST" })
  .inputValidator((input: { email: string; password: string; displayName?: string }) => {
    if (!input?.email || !input?.password) throw new Error("Email and password required");
    if (input.password.length < 8) throw new Error("Password must be at least 8 characters");
    if (!emailDomainAllowed(input.email)) {
      throw new Error("Signup restricted to @cintara.ai and @revcloud.com email addresses");
    }
    return input;
  })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const email = data.email.trim().toLowerCase();

    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: data.password,
      email_confirm: true,
      user_metadata: { display_name: data.displayName ?? null },
    });
    if (error || !created.user) {
      throw new Error(error?.message ?? "Could not create account");
    }
    const userId = created.user.id;

    await supabaseAdmin.from("profiles").upsert({
      id: userId,
      email,
      display_name: data.displayName ?? null,
    });

    // First user becomes the super admin automatically.
    const { count } = await supabaseAdmin
      .from("user_roles")
      .select("id", { count: "exact", head: true })
      .eq("role", "super_admin");
    const role = (count ?? 0) === 0 ? "super_admin" : "user";

    await supabaseAdmin.from("user_roles").insert({ user_id: userId, role });
    return { ok: true, role };
  });

/** Returns the signed-in user's roles + super-admin flag. */
export const getMyRoles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    const roles = (data ?? []).map((r) => r.role as string);
    return { roles, isSuperAdmin: roles.includes("super_admin") };
  });
