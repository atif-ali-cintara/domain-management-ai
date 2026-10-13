import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import logo from "@/assets/alyson-logo.svg.asset.json";

const ALLOWED = "cintara.ai";
const isAllowed = (email?: string | null) =>
  (email ?? "").trim().toLowerCase().split("@")[1] === ALLOWED;

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Sign in — Alyson Domain Platform" },
      { name: "description", content: "Sign in to Alyson with your Cintara Google account." },
      { property: "og:title", content: "Sign in — Alyson Domain Platform" },
      { property: "og:description", content: "Sign in to Alyson with your Cintara Google account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const check = async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) return;
      if (isAllowed(data.user.email)) navigate({ to: "/dashboard" });
      else {
        await supabase.auth.signOut();
        setErr("Only @cintara.ai Google accounts can access this platform.");
      }
    };
    check();
    const { data: sub } = supabase.auth.onAuthStateChange((e) => {
      if (e === "SIGNED_IN") check();
    });
    const qs = new URLSearchParams(window.location.hash.slice(1) + "&" + window.location.search.slice(1));
    if (qs.get("error_description")) setErr("Only @cintara.ai Google accounts can access this platform.");
    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  async function signIn() {
    setErr(null);
    setBusy(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin + "/auth",
      extraParams: { hd: ALLOWED, prompt: "select_account" },
    });
    if (result.error) {
      setErr("Only @cintara.ai Google accounts can access this platform.");
      setBusy(false);
      return;
    }
    if (result.redirected) return;
    setBusy(false);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center gap-3 mb-8">
          <img src={logo.url} alt="Alyson" className="h-14 w-14" />
          <h1 className="text-2xl font-semibold tracking-tight">Alyson</h1>
          <p className="text-sm text-muted-foreground">Domain Management Platform</p>
        </div>
        <div className="rounded-xl border border-border bg-card shadow-card p-6 space-y-4">
          <Button onClick={signIn} disabled={busy} className="w-full">
            {busy ? "Redirecting…" : "Continue with Google"}
          </Button>
          {err && (
            <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md p-2">
              {err}
            </div>
          )}
          <p className="text-xs text-muted-foreground text-center">
            Access restricted to @{ALLOWED} Google Workspace accounts.
          </p>
        </div>
      </div>
    </div>
  );
}
