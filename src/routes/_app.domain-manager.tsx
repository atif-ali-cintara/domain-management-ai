import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowUpDown, Download, RefreshCw } from "lucide-react";
import { getManagedDomains, type ManagedDomain } from "@/lib/domain-manager.functions";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type SortKey = keyof Pick<ManagedDomain, "domain" | "registrar" | "accountName" | "accountUsername" | "contactEmail" | "expires" | "status">;

function DomainManagerPage() {
  const fetchFn = useServerFn(getManagedDomains);
  const qc = useQueryClient();
  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: ["domain-manager"],
    queryFn: () => fetchFn({ data: {} }),
    staleTime: 5 * 60_000,
  });
  const [q, setQ] = useState("");
  const [registrar, setRegistrar] = useState("all");
  const [account, setAccount] = useState("all");
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "expires", dir: 1 });

  const all = data?.domains ?? [];
  const accountsList = useMemo(() => [...new Set(all.map((d) => d.accountName))].sort(), [all]);

  const rows = useMemo(() => {
    const n = q.trim().toLowerCase();
    return all
      .filter((d) => registrar === "all" || d.registrar === registrar)
      .filter((d) => account === "all" || d.accountName === account)
      .filter((d) => !n || [d.domain, d.accountName, d.accountUsername, d.contactEmail ?? ""].some((v) => v.toLowerCase().includes(n)))
      .sort((a, b) => {
        const av = a[sort.key] ?? "";
        const bv = b[sort.key] ?? "";
        if (!av && bv) return 1;
        if (av && !bv) return -1;
        return String(av).localeCompare(String(bv)) * sort.dir;
      });
  }, [all, q, registrar, account, sort]);

  async function refresh() {
    const fresh = await fetchFn({ data: { refresh: true } });
    qc.setQueryData(["domain-manager"], fresh);
  }

  function exportCsv() {
    const head = ["Domain", "Registrar", "Account name", "Account username", "Contact email", "Expires", "Days left", "Status", "Auto-renew"];
    const lines = rows.map((d) =>
      [d.domain, d.registrar, d.accountName, d.accountUsername, d.contactEmail ?? "", d.expires?.slice(0, 10) ?? "", d.expiresInDays ?? "", d.status, d.autoRenew ? "yes" : "no"]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(","),
    );
    const blob = new Blob([[head.join(","), ...lines].join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "domains.csv";
    a.click();
  }

  const H = ({ k, children }: { k: SortKey; children: string }) => (
    <TableHead>
      <button
        className="inline-flex items-center gap-1 hover:text-foreground"
        onClick={() => setSort((s) => ({ key: k, dir: s.key === k ? (s.dir === 1 ? -1 : 1) : 1 }))}
      >
        {children}
        <ArrowUpDown className={`h-3 w-3 ${sort.key === k ? "text-foreground" : "opacity-40"}`} />
      </button>
    </TableHead>
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Domain Manager</h1>
          <p className="text-sm text-muted-foreground">
            {isLoading ? "Loading domains from your registrar accounts…" : `${rows.length} of ${all.length} domains`}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={!rows.length}>
            <Download className="h-4 w-4" /> CSV
          </Button>
          <Button size="sm" onClick={refresh} disabled={isFetching}>
            <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} /> Refresh
          </Button>
        </div>
      </div>

      {error && <div className="text-sm text-destructive">{(error as Error).message}</div>}

      <div className="flex flex-wrap gap-2">
        <Input placeholder="Search domain, account, email…" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-xs" />
        <select className="h-9 rounded-md border border-input bg-background px-2 text-sm" value={registrar} onChange={(e) => setRegistrar(e.target.value)}>
          <option value="all">All registrars</option>
          <option>Namecheap</option>
          <option>GoDaddy</option>
          <option>101domains</option>
        </select>
        <select className="h-9 rounded-md border border-input bg-background px-2 text-sm" value={account} onChange={(e) => setAccount(e.target.value)}>
          <option value="all">All accounts</option>
          {accountsList.map((a) => <option key={a}>{a}</option>)}
        </select>
      </div>

      <Card className="p-0 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <H k="domain">Domain</H>
              <H k="registrar">Registrar</H>
              <H k="accountName">Account name</H>
              <H k="accountUsername">Username</H>
              <H k="contactEmail">Contact email</H>
              <H k="expires">Expires</H>
              <H k="status">Status</H>
              <TableHead>Auto-renew</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((d) => {
              const dl = d.expiresInDays;
              const tone = dl == null ? "" : dl < 0 ? "text-destructive font-medium" : dl < 30 ? "text-destructive" : dl < 60 ? "text-[color:var(--status-warning,theme(colors.amber.600))]" : "text-muted-foreground";
              return (
                <TableRow key={d.registrar + d.domain}>
                  <TableCell className="font-mono text-xs">{d.domain}</TableCell>
                  <TableCell>{d.registrar}</TableCell>
                  <TableCell className="text-sm font-medium">{d.accountName}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{d.accountUsername}</TableCell>
                  <TableCell className="text-sm">{d.contactEmail ?? <span className="text-muted-foreground">—</span>}</TableCell>
                  <TableCell className="text-sm whitespace-nowrap">
                    {d.expires ? d.expires.slice(0, 10) : "—"}
                    {dl != null && <span className={`ml-2 text-xs ${tone}`}>{dl < 0 ? `expired ${-dl}d ago` : `${dl}d`}</span>}
                  </TableCell>
                  <TableCell><Badge variant={d.status === "ACTIVE" ? "secondary" : "outline"}>{d.status}</Badge></TableCell>
                  <TableCell className="text-sm">{d.autoRenew ? "On" : <span className="text-destructive">Off</span>}</TableCell>
                </TableRow>
              );
            })}
            {!isLoading && !rows.length && (
              <TableRow><TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-10">No domains found.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

export const Route = createFileRoute("/_app/domain-manager")({
  head: () => ({
    meta: [
      { title: "Domain Manager — Alyson" },
      { name: "description", content: "Every domain across Namecheap, GoDaddy and 101domains, sortable by account, email and expiry." },
      { property: "og:title", content: "Domain Manager — Alyson" },
      { property: "og:description", content: "All registrar domains in one sortable list." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DomainManagerPage,
});
