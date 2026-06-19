import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { signUpWithDomainCheck } from "@/lib/auth.functions";
import { ALLOWED_EMAIL_DOMAINS, emailDomainAllowed } from "@/lib/auth-config";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import logo from "@/assets/alyson-logo.svg.asset.json";

export const Route = createFileRoute("/auth")({
  ssr: false,
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const signUp = useServerFn(signUpWithDomainCheck);
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/dashboard" });
    });
  }, [navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!emailDomainAllowed(email)) {
      setErr(`Email must end with ${ALLOWED_EMAIL_DOMAINS.map((d) => "@" + d).join(" or ")}`);
      return;
    }
    setBusy(true);
    try {
      if (mode === "signup") {
        await signUp({ data: { email, password } });
      }
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      navigate({ to: "/dashboard" });
    } catch (e: any) {
      setErr(e?.message ?? "Authentication failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center gap-3 mb-8">
          <img src={logo.url} alt="Alyson" className="h-14 w-14" />
          <h1 className="text-2xl font-semibold tracking-tight">Alyson</h1>
          <p className="text-sm text-muted-foreground">Domain Management Platform</p>
        </div>

        <div className="rounded-xl border border-border bg-card shadow-card p-6">
          <div className="flex gap-1 p-1 rounded-lg bg-muted mb-5">
            {(["signin", "signup"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`flex-1 text-sm font-medium rounded-md py-1.5 transition-colors ${
                  mode === m ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
                }`}
              >
                {m === "signin" ? "Sign in" : "Sign up"}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Work email</Label>
              <Input id="email" type="email" required value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@cintara.ai" autoComplete="email" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" required minLength={8} value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete={mode === "signin" ? "current-password" : "new-password"} />
            </div>

            {err && (
              <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md p-2">
                {err}
              </div>
            )}

            <Button type="submit" disabled={busy} className="w-full">
              {busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
            </Button>

            <p className="text-xs text-muted-foreground text-center">
              Access restricted to {ALLOWED_EMAIL_DOMAINS.map((d) => "@" + d).join(" and ")} email addresses.
            </p>
          </form>
        </div>

        <p className="text-xs text-muted-foreground text-center mt-6">
          <Link to="/" className="hover:underline">← Back to home</Link>
        </p>
      </div>
    </div>
  );
}
