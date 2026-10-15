import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowUpDown, CheckCircle2, Download, RefreshCw, XCircle } from "lucide-react";
import { getManagedDomains, type ManagedDomain } from "@/lib/domain-manager.functions";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
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

  const [showExpired, setShowExpired] = useState(false);
  const isExpired = (d: ManagedDomain) => d.status.toUpperCase() === "EXPIRED" || (d.expiresInDays != null && d.expiresInDays < 0);
  const everything = data?.domains ?? [];
  const all = useMemo(() => everything.filter((d) => !isExpired(d)), [everything]);
  const expired = useMemo(() => everything.filter(isExpired).sort((a, b) => (b.expires ?? "").localeCompare(a.expires ?? "")), [everything]);
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

  const [perPage, setPerPage] = useState<number>(50);
  const [page, setPage] = useState(1);
  const [bucket, setBucket] = useState<null | 30 | 60 | 90>(null);
  const pages = perPage ? Math.max(1, Math.ceil(rows.length / perPage)) : 1;
  const curPage = Math.min(page, pages);
  const pageRows = perPage ? rows.slice((curPage - 1) * perPage, curPage * perPage) : rows;
  useEffect(() => setPage(1), [q, registrar, account, sort, perPage]);
  const inBucket = (d: ManagedDomain, b: 30 | 60 | 90) => {
    const dl = d.expiresInDays;
    if (dl == null || dl < 0) return false;
    return b === 30 ? dl <= 30 : b === 60 ? dl > 30 && dl <= 60 : dl > 60 && dl <= 90;
  };
  const due = { 30: rows.filter((d) => inBucket(d, 30)), 60: rows.filter((d) => inBucket(d, 60)), 90: rows.filter((d) => inBucket(d, 90)) };

  async function refresh() {
    const fresh = await fetchFn({ data: { refresh: true } });
    qc.setQueryData(["domain-manager"], fresh);
  }

  function exportCsv() {
    const head = ["Domain", "Registrar", "Account name", "Account username", "Contact email", "Expires", "Days left", "Status", "Auto-renew", "Privacy", "Importance", "Category"];
    const lines = rows.map((d) =>
      [d.domain, d.registrar, d.accountName, d.accountUsername, d.contactEmail ?? "", d.expires?.slice(0, 10) ?? "", d.expiresInDays ?? "", d.status, d.autoRenew ? "yes" : "no", d.privacy == null ? "" : d.privacy ? "on" : "off", d.importance ?? "", d.category ?? ""]
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
              <TableHead>Privacy</TableHead>
              <TableHead>Importance</TableHead>
              <TableHead>Category</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageRows.map((d) => {
              const dl = d.expiresInDays;
              const tone = dl == null ? "" : dl < 0 ? "text-destructive font-medium" : dl < 30 ? "text-destructive" : dl < 60 ? "text-[color:var(--status-warning,theme(colors.amber.600))]" : "text-muted-foreground";
              return (
                <TableRow key={d.registrar + d.domain}>
                  <TableCell className="font-mono text-xs">
                    {d.domain}
                    {d.source === "sheet" && <Badge variant="outline" className="ml-2 font-sans text-[10px]">From sheet</Badge>}
                  </TableCell>
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
                  <TableCell className="text-sm">{d.privacy == null ? <span className="text-muted-foreground">—</span> : d.privacy ? "On" : "Off"}</TableCell>
                  <TableCell className="text-sm">{d.importance ?? <span className="text-muted-foreground">—</span>}</TableCell>
                  <TableCell>{d.category ? <Badge variant={d.category === "Critical" ? "destructive" : "outline"}>{d.category}</Badge> : <span className="text-sm text-muted-foreground">—</span>}</TableCell>
                </TableRow>
              );
            })}
            {!isLoading && !rows.length && (
              <TableRow><TableCell colSpan={11} className="text-center text-sm text-muted-foreground py-10">No domains found.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <label className="flex items-center gap-2 text-muted-foreground">
          Show
          <select className="h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground" value={perPage} onChange={(e) => setPerPage(Number(e.target.value))}>
            <option value={10}>10</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
            <option value={0}>All</option>
          </select>
          per page
        </label>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled={curPage <= 1} onClick={() => setPage(curPage - 1)}>Previous</Button>
          <span className="text-muted-foreground">Page {curPage} of {pages}</span>
          <Button variant="outline" size="sm" disabled={curPage >= pages} onClick={() => setPage(curPage + 1)}>Next</Button>
        </div>
      </div>

      <Card className="p-4">
        <h2 className="mb-3 text-sm font-semibold">Status summary <span className="font-normal text-muted-foreground">(expired domains not counted)</span></h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-md border border-border p-3">
            <div className="text-xs text-muted-foreground">Total domains</div>
            <div className="text-2xl font-semibold">{rows.length}</div>
          </div>
          {([30, 60, 90] as const).map((b) => (
            <button key={b} onClick={() => setBucket(bucket === b ? null : b)} className={`rounded-md border p-3 text-left hover:bg-muted/50 ${bucket === b ? "border-primary" : "border-border"}`}>
              <div className="text-xs text-muted-foreground">{b === 30 ? "Due in 30 days" : b === 60 ? "Due in 31–60 days" : "Due in 61–90 days"}</div>
              <div className={`text-2xl font-semibold ${b === 30 && due[30].length ? "text-destructive" : ""}`}>{due[b].length}</div>
            </button>
          ))}
        </div>
        {bucket && (
          <div className="mt-4">
            <div className="mb-2 text-sm font-medium">Renewal tasks — {bucket === 30 ? "next 30 days" : bucket === 60 ? "31–60 days" : "61–90 days"}</div>
            {due[bucket].length ? (
              <ul className="space-y-1 text-sm">
                {[...due[bucket]].sort((a, b) => (a.expiresInDays ?? 0) - (b.expiresInDays ?? 0)).map((d) => (
                  <li key={"t" + d.registrar + d.domain} className="flex flex-wrap justify-between gap-2 border-b border-border/60 pb-1 last:border-0">
                    <span>Renew <span className="font-mono text-xs">{d.domain}</span> <span className="text-muted-foreground">· {d.registrar} · {d.accountName}</span></span>
                    <span className="text-xs text-muted-foreground">{d.expires?.slice(0, 10)} ({d.expiresInDays}d){!d.autoRenew && <span className="ml-1 text-destructive">auto-renew off</span>}</span>
                  </li>
                ))}
              </ul>
            ) : <p className="text-sm text-muted-foreground">Nothing due in this window.</p>}
          </div>
        )}
      </Card>

      {data && (() => {
        const connected = data.accounts.filter((a) => a.ok);
        const notConnected = data.accounts.filter((a) => !a.ok);
        const totalDomains = connected.reduce((s, a) => s + a.count, 0);
        return (
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="p-4">
              <div className="mb-3 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-[color:var(--status-success,theme(colors.emerald.600))]" />
                <h2 className="text-sm font-semibold">API connected</h2>
                <Badge variant="secondary" className="ml-auto">{connected.length} account{connected.length === 1 ? "" : "s"}</Badge>
              </div>
              {connected.length ? (
                <ul className="space-y-1.5 text-sm">
                  {connected.map((a, i) => (
                    <li key={i} className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-1.5 last:border-0 last:pb-0">
                      <span>
                        <span className="font-medium">{a.registrar}</span>
                        <span className="text-muted-foreground"> · {a.account}</span>
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {a.count} domain{a.count === 1 ? "" : "s"}
                        {a.message && <span className="ml-1">({a.message})</span>}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">No accounts connected yet.</p>
              )}
              <p className="mt-3 text-xs text-muted-foreground">{totalDomains} domains pulled from connected accounts.</p>
            </Card>
            <Card className="p-4">
              <div className="mb-3 flex items-center gap-2">
                <XCircle className="h-4 w-4 text-muted-foreground" />
                <h2 className="text-sm font-semibold">Not connected</h2>
                <Badge variant="outline" className="ml-auto">{notConnected.length} account{notConnected.length === 1 ? "" : "s"}</Badge>
              </div>
              {notConnected.length ? (
                <ul className="space-y-1.5 text-sm">
                  {notConnected.map((a, i) => (
                    <li key={i} className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-1.5 last:border-0 last:pb-0">
                      <span>
                        <span className="font-medium">{a.registrar}</span>
                        <span className="text-muted-foreground"> · {a.account}</span>
                      </span>
                      <span className="text-xs text-muted-foreground">{a.message}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">All accounts are connected.</p>
              )}
            </Card>
          </div>
        );
      })()}

      <Card className="p-4">
        <label className="flex cursor-pointer items-center justify-between gap-3">
          <span>
            <span className="text-sm font-semibold">Show expired domains</span>
            <span className="ml-2 text-xs text-muted-foreground">{expired.length} expired, hidden from the list above</span>
          </span>
          <Switch checked={showExpired} onCheckedChange={setShowExpired} />
        </label>
        {showExpired && (
          <div className="mt-4">
            {expired.length ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Domain</TableHead>
                    <TableHead>Registrar</TableHead>
                    <TableHead>Account name</TableHead>
                    <TableHead>Contact email</TableHead>
                    <TableHead>Expired on</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {expired.map((d) => (
                    <TableRow key={"x" + d.registrar + d.domain}>
                      <TableCell className="font-mono text-xs">{d.domain}</TableCell>
                      <TableCell>{d.registrar}</TableCell>
                      <TableCell className="text-sm">{d.accountName}</TableCell>
                      <TableCell className="text-sm">{d.contactEmail ?? "—"}</TableCell>
                      <TableCell className="text-sm text-destructive">{d.expires ? d.expires.slice(0, 10) : "—"}</TableCell>
                      <TableCell><Badge variant="outline">{d.status}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-sm text-muted-foreground">No expired domains.</p>
            )}
          </div>
        )}
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
