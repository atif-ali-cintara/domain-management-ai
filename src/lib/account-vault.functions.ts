import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type AccountCredential = {
  id: string;
  vendor: string;
  company_name: string | null;
  category: string;
  registrant_username: string | null;
  account_email: string | null;
  twofa_owner: string | null;
  email_forwarder: string | null;
  notes: string | null;
  registrant_password: string | null;
  email_password: string | null;
  new_password: string | null;
  api_key: string | null;
  extra: Record<string, string> | null;
};

async function assertSuperAdmin(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "super_admin",
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: super admin only");
}

export const listAccountCredentials = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AccountCredential[]> => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { decryptSecret } = await import("./vault.server");
    const { data, error } = await supabaseAdmin
      .from("account_credentials")
      .select("*")
      .order("vendor", { ascending: true })
      .order("company_name", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []).map((row: any) => ({
      id: row.id,
      vendor: row.vendor,
      company_name: row.company_name,
      category: row.category,
      registrant_username: row.registrant_username,
      account_email: row.account_email,
      twofa_owner: row.twofa_owner,
      email_forwarder: row.email_forwarder,
      notes: row.notes,
      registrant_password: decryptSecret(row.registrant_password_enc),
      email_password: decryptSecret(row.email_password_enc),
      new_password: decryptSecret(row.new_password_enc),
      api_key: decryptSecret(row.api_key_enc),
      extra: row.extra_enc ? JSON.parse(decryptSecret(row.extra_enc) || "null") : null,
    }));
  });

/**
 * Idempotently load the credentials from the uploaded PDF into the vault,
 * encrypting all secret fields at rest. Safe to re-run; matches on
 * (vendor, company_name) and replaces.
 */
export const seedAccountCredentials = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { encryptSecret } = await import("./vault.server");

    type Seed = {
      vendor: string;
      company_name?: string | null;
      category?: string;
      registrant_username?: string | null;
      account_email?: string | null;
      twofa_owner?: string | null;
      email_forwarder?: string | null;
      notes?: string | null;
      registrant_password?: string | null;
      email_password?: string | null;
      new_password?: string | null;
      api_key?: string | null;
      extra?: Record<string, string> | null;
    };

    const seeds: Seed[] = [
      // Namecheap registrar accounts
      { vendor: "NameCheap", company_name: "Fluxa Leads", registrant_username: "iqrasabtain4772", registrant_password: "Sabtain4772", account_email: "iqrasabtain4772@gmail.com", email_password: "M@FH2&hHgOCbe1#M", new_password: "Revcloud1234!", twofa_owner: "access@cintara.ai", email_forwarder: "access@cintara.ai", api_key: "643765413a6d48e3a177cc5a92658440" },
      { vendor: "NameCheap", company_name: "RevX Home Services", registrant_username: "subtainrevX", registrant_password: "Partners.RevX", account_email: "m.sabtain9646@gmail.com", email_password: "IamSabbu678@@", new_password: "Revcloud1234!", twofa_owner: "access@cintara.ai", email_forwarder: "access@cintara.ai", notes: "Phone number is inactive; could not change password.", api_key: null },
      { vendor: "NameCheap", company_name: "People Amplify", registrant_username: "abdullahr98", registrant_password: "Twice123@@", account_email: "abdullahraheem136@gmail.com", email_password: "@ARaheem136", new_password: "Revcloud1234!", twofa_owner: "access@cintara.ai", api_key: null },
      { vendor: "NameCheap", company_name: "Better People Ops", registrant_username: "ahsanraza001", registrant_password: "Raza@1234", account_email: "ahsanrazakhokhar24@gmail.com", email_password: "Twice@1234", new_password: "Revcloud1234!", twofa_owner: "access@cintara.ai", email_forwarder: "access@cintara.ai", api_key: null },
      { vendor: "NameCheap", company_name: "Cintara.AI", registrant_username: "ayeshanadeem01", registrant_password: "Cintara@11", account_email: "ayesha.nadeem7204@gmail.com", email_password: "Revcloud1234!", new_password: "Revcloud1234!", twofa_owner: "access@cintara.ai", api_key: "4711feb4fed0426f9d58d40f2a50b156" },
      { vendor: "NameCheap", company_name: "Better People Support", registrant_username: "aliraza908", registrant_password: "Support@1234", account_email: "aliraza27656@gmail.com", email_password: "Ilove786@", new_password: "Revcloud1234!", twofa_owner: "access@cintara.ai", email_forwarder: "access@cintara.ai", api_key: null },
      { vendor: "NameCheap", company_name: "Ardexa", registrant_username: "khalidmehmood21", registrant_password: "Ardexa@112", account_email: "javedkhalidmalik@gmail.com", notes: "Asked to change email.", twofa_owner: "access@cintara.ai", api_key: "bc3cbb240d9e46249fc9b7ba9ced46fe" },
      { vendor: "NameCheap", company_name: "Growth Rethink", registrant_username: "maheenfaisal2f", registrant_password: "Rethink@112", account_email: "faisalbhattir2f@gmail.com", notes: "Asked to change email.", twofa_owner: "access@cintara.ai", api_key: null },
      { vendor: "NameCheap", company_name: "Tracking Link Tech", registrant_username: "kamranmalik22", registrant_password: "*Kamran12#", account_email: "kamisnapads@gmail.com", email_password: "*Kamran25#", new_password: "Revcloud1234!", twofa_owner: "access@cintara.ai", email_forwarder: "access@cintara.ai", api_key: null },
      { vendor: "NameCheap", company_name: "Hownerly Nexa", registrant_username: "muhammadanish33789", registrant_password: "Nightmare@333", account_email: "danish.dani7708@gmail.com", email_password: "Revcloud1234!", new_password: "Revcloud1234!", api_key: null },
      { vendor: "NameCheap", company_name: "Curb Nexa", registrant_username: "Iqraworkspace", registrant_password: "iqruu65@#password", account_email: "iqraaaa189@gmail.com", email_password: "iqruu65@#", new_password: "Revcloud1234!", twofa_owner: "access@cintara.ai", notes: "Unable to reach owner for 2FA.", api_key: null },
      { vendor: "NameCheap", company_name: "Hearth Vero", registrant_username: "rabiaimran5424", registrant_password: "Nightmare@333", account_email: "rabiaimran5424@gmail.com", email_password: "Asdf1234@", new_password: "Revcloud1234!", twofa_owner: "access@cintara.ai", notes: "2-Step Verification locked for seven days.", api_key: null },
      { vendor: "NameCheap", company_name: "Curbly Mint", registrant_username: "kalsoom538452", registrant_password: "B-!SfT_#8Uebrwr", account_email: "kalsoom234323@gmail.com", email_password: "Palisade@1122", twofa_owner: "access@cintara.ai", api_key: null },
      { vendor: "NameCheap", company_name: "Revcloud", registrant_username: "BillRevcloud", account_email: "expensesa4@gmail.com", email_password: "Revcloud1234!", new_password: "Revcloud1234!", twofa_owner: "access@cintara.ai", email_forwarder: "access@cintara.ai", api_key: "f7889265df0f4cab9bbd41e85198ae46" },
      { vendor: "NameCheap", company_name: "ContentCognition", registrant_username: "MohitaContentCogniti", account_email: "iqra.rafique@contentcognition.net", email_password: "Content123!", new_password: "Content123!", twofa_owner: "access@cintara.ai", email_forwarder: "access@cintara.ai", api_key: "30936cd4ef064f6aaa6d4232429f3295" },
      { vendor: "NameCheap", company_name: "Dead Account (NameCheap)", registrant_username: "shahzadm342", registrant_password: "Shazi@112", account_email: "sshahzadshahzad144@gmail.com", email_password: "786786786@shahzad", twofa_owner: "access@cintara.ai", api_key: "117c563c06554e2b9fb570a51d1c7e8b" },

      // GoDaddy
      { vendor: "GoDaddy", company_name: "Dead Account (GoDaddy)", registrant_username: "shahzadm342", registrant_password: "Shazi@112", account_email: "sshahzadshahzad144@gmail.com", email_password: "786786786@shahzad", twofa_owner: "access@cintara.ai", api_key: null, extra: { key: "h2p9D9d46kWc_DhCtktHHKwTAFzoG9FwrER", secret: "Np2SL2EDFYgJjNYDFpw4yN" } },

      // Platforms
      { vendor: "MessageMedia", category: "platform", company_name: "RevX Home Services", account_email: "subtain@revhomoeservices", email_password: "RevXNew12345!", twofa_owner: "access@cintara.ai" },
      { vendor: "Heroku", category: "platform", company_name: "Tracking Link Tech", account_email: "kamran@trackinglinktech.com", email_password: ")(*^%^&&jhgig987787", twofa_owner: "access@cintara.ai" },
      { vendor: "G-Suite", category: "platform", company_name: "ContentCognition", account_email: "Iqra.rafique@contentcognition.net", twofa_owner: "access@cintara.ai", notes: "Email forwarder already set up." },
      { vendor: "G-Suite", category: "platform", company_name: "Fluxa Leads", account_email: "iqra@fluxaleads.com", email_password: "Fluxa@112", twofa_owner: "access@cintara.ai", email_forwarder: "access@cintara.ai" },
      { vendor: "G-Suite", category: "platform", company_name: "RevX", account_email: "legal@revx.partners", twofa_owner: "access@cintara.ai" },
      { vendor: "G-Suite", category: "platform", company_name: "RevX Home Services", account_email: "subtain@revxhomeservices.com", email_password: "RevXhome@11", twofa_owner: "access@cintara.ai", email_forwarder: "access@cintara.ai" },
      { vendor: "G-Suite", category: "platform", company_name: "People Amplify", account_email: "abdullah@peopleamplify.com", email_password: "Amplify998@", notes: "Account suspended." },
      { vendor: "G-Suite", category: "platform", company_name: "Cintara.AI", account_email: "ayesha@cintara.ai", email_password: "Ayesha@2839", twofa_owner: "access@cintara.ai", email_forwarder: "access@cintara.ai" },
      { vendor: "G-Suite", category: "platform", company_name: "Better People Support", account_email: "ali@BetterPeopleSupport.com", email_password: "Better@112", twofa_owner: "access@cintara.ai", notes: "Forwarder not set up; unable to get OTP." },
      { vendor: "G-Suite", category: "platform", company_name: "Ardexa", account_email: "khalid@ardexaai.com", email_password: "Ardexa@112", twofa_owner: "access@cintara.ai", email_forwarder: "access@cintara.ai" },
      { vendor: "G-Suite", category: "platform", company_name: "Growth Rethink", account_email: "maheen@GrowthRethink.com", email_password: "Rethink@112", notes: "Account suspended." },
      { vendor: "G-Suite", category: "platform", company_name: "Tracking Link Tech", account_email: "kamran@trackinglinktech.com", email_password: ")(*^%^&&jhgig987787", twofa_owner: "access@cintara.ai", email_forwarder: "access@cintara.ai" },
      { vendor: "G-Suite", category: "platform", company_name: "Curb Nexa", account_email: "iqra.bilal@CurbNexa.com", email_password: "Password12", notes: "Account suspended." },
      { vendor: "G-Suite", category: "platform", company_name: "Curbly Mint", account_email: "UmeKalsoom@CurblyMint.com", email_password: "Nightmare@333", notes: "Account suspended." },
      { vendor: "Trumpia", category: "platform", company_name: "Ardexa", registrant_username: "KhalidMehmood", email_password: "Ardexaai1234!", notes: "https://responsive.trumpia.com/account/login" },
      { vendor: "PitchPrfct", category: "platform", company_name: "Ardexa", account_email: "khalid@ardexaai.com", email_password: "Ardexaai1234!", notes: "https://app.pitchprfct.com" },
    ];

    // Wipe then reinsert so re-running is idempotent (super_admin only).
    await supabaseAdmin.from("account_credentials").delete().neq("id", "00000000-0000-0000-0000-000000000000");

    const rows = seeds.map((s) => ({
      vendor: s.vendor,
      company_name: s.company_name ?? null,
      category: s.category ?? "registrar",
      registrant_username: s.registrant_username ?? null,
      account_email: s.account_email ?? null,
      twofa_owner: s.twofa_owner ?? null,
      email_forwarder: s.email_forwarder ?? null,
      notes: s.notes ?? null,
      registrant_password_enc: encryptSecret(s.registrant_password),
      email_password_enc: encryptSecret(s.email_password),
      new_password_enc: encryptSecret(s.new_password),
      api_key_enc: encryptSecret(s.api_key),
      extra_enc: s.extra ? encryptSecret(JSON.stringify(s.extra)) : null,
    }));

    const { error } = await supabaseAdmin.from("account_credentials").insert(rows);
    if (error) throw new Error(error.message);
    return { ok: true, count: rows.length };
  });
