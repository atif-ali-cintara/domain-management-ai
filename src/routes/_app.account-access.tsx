import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { listAccountCredentials, seedAccountCredentials, type AccountCredential } from "@/lib/account-vault.functions";
import { getMyRoles } from "@/lib/auth.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Eye, EyeOff, Copy, ShieldAlert, Search, Database, KeyRound } from "lucide-react";

export const Route = createFileRoute("/_app/account-access")({
  component: AccountAccessPage,
});

function AccountAccessPage() {
  const fetchRoles = useServerFn(getMyRoles);
  const fetchList = useServerFn(listAccountCredentials);
  const runSeed = useServerFn(seedAccountCredentials);

  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [rows, setRows] = useState<AccountCredential[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [vendorFilter, setVendorFilter] = useState<string>("all");

  useEffect(() => {
    (async () => {
      try {
        const r = await fetchRoles();
        if (!r.isSuperAdmin) {
          setAuthorized(false);
          setLoading(false);
          return;
        }
        setAuthorized(true);
        const data = await fetchList();
        setRows(data);
      } catch (e: any) {
        setErr(e?.message ?? "Failed to load");
      } finally {
        setLoading(false);
      }
    })();
  }, [fetchRoles, fetchList]);

  async function doSeed() {
    setLoading(true);
    setErr(null);
    try {
      await runSeed();
      const data = await fetchList();
      setRows(data);
    } catch (e: any) {
      setErr(e?.message ?? "Seed failed");
    } finally {
      setLoading(false);
    }
  }

  const vendors = useMemo(() => Array.from(new Set(rows.map((r) => r.vendor))).sort(), [rows]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (vendorFilter !== "all" && r.vendor !== vendorFilter) return false;
      if (!q) return true;
      return [r.vendor, r.company_name, r.registrant_username, r.account_email, r.twofa_owner]
        .some((v) => (v ?? "").toLowerCase().includes(q));
    });
  }, [rows, query, vendorFilter]);

  if (authorized === false) {
    return (
      <div className="max-w-xl mx-auto mt-20">
        <Card>
          <CardContent className="p-8 flex flex-col items-center text-center gap-3">
            <ShieldAlert className="h-10 w-10 text-destructive" />
            <h2 className="text-lg font-semibold">Restricted</h2>
            <p className="text-sm text-muted-foreground">
              Account Access is visible only to the super admin. If you believe this is an
              error, contact your platform owner.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Account Access</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Encrypted vault of every vendor login, API key, and 2FA owner. Super admin only.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="gap-1.5">
            <KeyRound className="h-3 w-3" /> {rows.length} entries
          </Badge>
          {rows.length === 0 && (
            <Button onClick={doSeed} disabled={loading} size="sm">
              <Database className="h-4 w-4 mr-1.5" /> Load credentials
            </Button>
          )}
        </div>
      </div>

      {err && (
        <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md p-3">
          {err}
        </div>
      )}

      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder="Search vendor, company, email…" className="pl-9" />
        </div>
        <select value={vendorFilter} onChange={(e) => setVendorFilter(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm">
          <option value="all">All vendors</option>
          {vendors.map((v) => <option key={v} value={v}>{v}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filtered.map((row) => <CredentialCard key={row.id} row={row} />)}
          {filtered.length === 0 && (
            <div className="col-span-full text-sm text-muted-foreground text-center py-12 border border-dashed rounded-lg">
              No credentials match.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function CredentialCard({ row }: { row: AccountCredential }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base">{row.company_name ?? "(unnamed)"}</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">{row.vendor} · {row.category}</p>
          </div>
          {row.twofa_owner && (
            <Badge variant="outline" className="text-[10px] gap-1">
              <KeyRound className="h-3 w-3" /> 2FA: {row.twofa_owner}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <Field label="Username" value={row.registrant_username} />
        <Field label="Account email" value={row.account_email} />
        <SecretField label="Registrant password" value={row.registrant_password} />
        <SecretField label="Email password" value={row.email_password} />
        <SecretField label="New password" value={row.new_password} />
        <SecretField label="API key" value={row.api_key} mono />
        {row.extra && Object.entries(row.extra).map(([k, v]) => (
          <SecretField key={k} label={`Extra: ${k}`} value={v} mono />
        ))}
        {row.email_forwarder && <Field label="Email forwarder" value={row.email_forwarder} />}
        {row.notes && (
          <div className="pt-2 border-t border-border">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Notes</div>
            <p className="text-xs mt-0.5">{row.notes}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Field({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-[11px] uppercase tracking-wide text-muted-foreground shrink-0">{label}</span>
      <span className="text-xs text-right break-all">{value}</span>
    </div>
  );
}

function SecretField({ label, value, mono }: { label: string; value: string | null; mono?: boolean }) {
  const [show, setShow] = useState(false);
  if (!value) return null;
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[11px] uppercase tracking-wide text-muted-foreground shrink-0">{label}</span>
      <div className="flex items-center gap-1 min-w-0">
        <span className={`text-xs truncate ${mono ? "font-mono" : ""}`}>
          {show ? value : "•".repeat(Math.min(value.length, 12))}
        </span>
        <button type="button" onClick={() => setShow((s) => !s)}
          className="text-muted-foreground hover:text-foreground p-1" aria-label="Toggle visibility">
          {show ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
        </button>
        <button type="button" onClick={() => navigator.clipboard.writeText(value)}
          className="text-muted-foreground hover:text-foreground p-1" aria-label="Copy">
          <Copy className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
