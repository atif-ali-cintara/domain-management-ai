import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Copy, Download, RefreshCw, Search, Square } from "lucide-react";
import { toast } from "sonner";
import { checkDomainList } from "@/lib/domain-checker.functions";
import { getManagedDomains, type ManagedDomain } from "@/lib/domain-manager.functions";
import type { DomainResult } from "@/lib/domain-hunter.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const MAX = 200;
const BATCH = 25;
type Filter = "all" | "available" | "taken" | "ours" | "unknown";

export function parseDomainList(text: string): string[] {
  const out = new Set<string>();
  for (const raw of text.split(/[\s,;]+/)) {
    const d = raw.trim().toLowerCase().replace(/^[a-z]+:\/\//, "").replace(/^www\./, "").split(/[/?#]/)[0].replace(/\.$/, "");
    if (/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(d)) out.add(d);
  }
  return [...out];
}

function DomainCheckerPage() {
  const checkFn = useServerFn(checkDomainList);
  const managedFn = useServerFn(getManagedDomains);
  const { data: managed } = useQuery({ queryKey: ["domain-manager"], queryFn: () => managedFn({ data: {} }), staleTime: 5 * 60_000 });
  const ours = useMemo(() => {
    const m = new Map<string, ManagedDomain>();
    for (const d of managed?.domains ?? []) m.set(d.domain.toLowerCase(), d);
    return m;
  }, [managed]);

  const [text, setText] = useState("");
  const [results, setResults] = useState<Record<string, DomainResult | "pending">>({});
  const [order, setOrder] = useState<string[]>([]);
  const [running, setRunning] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const stop = useRef(false);
  const parsed = useMemo(() => parseDomainList(text), [text]);

  async function run() {
    const list = parsed.slice(0, MAX);
    if (!list.length) return toast.error("Enter at least one valid domain");
    if (parsed.length > MAX) toast.message(`Only the first ${MAX} domains will be checked`);
    stop.current = false;
    setRunning(true);
    setOrder(list);
    setResults(Object.fromEntries(list.map((d) => [d, "pending" as const])));
    for (let i = 0; i < list.length && !stop.current; i += BATCH) {
      const chunk = list.slice(i, i + BATCH);
      try {
        const { results: r } = await checkFn({ data: { domains: chunk } });
        setResults((p) => ({ ...p, ...Object.fromEntries(r.map((x) => [x.domain, x])) }));
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Check failed";
        setResults((p) => ({ ...p, ...Object.fromEntries(chunk.map((d) => [d, { domain: d, available: null, price: null, error: msg }])) }));
      }
    }
    setRunning(false);
  }

  async function recheck(d: string) {
    setResults((p) => ({ ...p, [d]: "pending" }));
    try {
      const { results: r } = await checkFn({ data: { domains: [d] } });
      setResults((p) => ({ ...p, [d]: r[0] }));
    } catch {
      setResults((p) => ({ ...p, [d]: { domain: d, available: null, price: null, error: "Check failed" } }));
    }
  }

  const done = order.filter((d) => results[d] && results[d] !== "pending").length;
  const statusOf = (d: string) => {
    const r = results[d];
    if (!r || r === "pending") return "pending";
    if (r.available === true) return "available";
    if (r.available === false) return "taken";
    return "unknown";
  };
  const counts = {
    all: order.length,
    available: order.filter((d) => statusOf(d) === "available").length,
    taken: order.filter((d) => statusOf(d) === "taken").length,
    ours: order.filter((d) => ours.has(d)).length,
    unknown: order.filter((d) => statusOf(d) === "unknown").length,
  };
  const rows = order.filter((d) => filter === "all" || (filter === "ours" ? ours.has(d) : statusOf(d) === filter));
  const availableList = order.filter((d) => statusOf(d) === "available");

  function exportCsv() {
    const head = ["Domain", "Characters", "Availability", "Premium price", "Source", "In portfolio", "Account", "Registrar", "Expires", "Days left"];
    const lines = order.map((d) => {
      const r = results[d];
      const o = ours.get(d);
      const rr = r && r !== "pending" ? r : null;
      return [d, d.split(".")[0].length, statusOf(d), rr?.price ?? "", rr?.source ?? "", o ? "Yes" : "No", o?.accountName ?? "", o?.registrar ?? "", o?.expires ?? "", o?.expiresInDays ?? ""]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",");
    });
    const blob = new Blob([[head.join(","), ...lines].join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "domain-status.csv";
    a.click();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Domain Checker</h1>
        <p className="text-sm text-muted-foreground">Paste a list of domains to check if they're available, taken, or already in your accounts.</p>
      </div>

      <Card className="space-y-3 p-4">
        <Textarea rows={7} value={text} onChange={(e) => setText(e.target.value)} placeholder={"example.com\nanother.ai, third.io"} className="font-mono text-sm" />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-sm text-muted-foreground">{parsed.length} valid domain{parsed.length === 1 ? "" : "s"}{parsed.length > MAX ? ` (max ${MAX})` : ""}</span>
          <div className="flex gap-2">
            {running && <Button variant="outline" onClick={() => (stop.current = true)}><Square className="mr-2 h-4 w-4" />Stop</Button>}
            <Button onClick={run} disabled={running || !parsed.length}><Search className="mr-2 h-4 w-4" />Check status</Button>
          </div>
        </div>
        {order.length > 0 && (
          <div className="space-y-1">
            <Progress value={(done / order.length) * 100} />
            <p className="text-xs text-muted-foreground">{done} of {order.length} checked</p>
          </div>
        )}
      </Card>

      {order.length > 0 && (
        <Card className="overflow-hidden p-0">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border p-3">
            <div className="flex flex-wrap gap-1">
              {(["all", "available", "taken", "ours", "unknown"] as Filter[]).map((f) => (
                <Button key={f} size="sm" variant={filter === f ? "default" : "ghost"} onClick={() => setFilter(f)} className="capitalize">
                  {f === "ours" ? "Ours" : f} ({counts[f]})
                </Button>
              ))}
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={!availableList.length} onClick={() => { navigator.clipboard.writeText(availableList.join("\n")); toast.success(`Copied ${availableList.length} available domains`); }}>
                <Copy className="mr-2 h-4 w-4" />Copy available
              </Button>
              <Button size="sm" variant="outline" onClick={exportCsv}><Download className="mr-2 h-4 w-4" />CSV</Button>
            </div>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Domain</TableHead>
                <TableHead>Availability</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>In our portfolio</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((d) => {
                const r = results[d];
                const rr = r && r !== "pending" ? r : null;
                const s = statusOf(d);
                const o = ours.get(d);
                return (
                  <TableRow key={d}>
                    <TableCell className="font-mono text-xs">{d} <span className="text-muted-foreground">({d.split(".")[0].length})</span></TableCell>
                    <TableCell>
                      {s === "pending" && <span className="text-xs text-muted-foreground">Checking…</span>}
                      {s === "available" && <Badge>{rr?.price ? `Premium $${rr.price}` : rr?.likely ? "Likely available" : "Available"}</Badge>}
                      {s === "taken" && <Badge variant="secondary">Taken</Badge>}
                      {s === "unknown" && <Badge variant="outline" title={rr?.error ?? undefined}>Unknown</Badge>}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{rr?.source === "namecheap" ? "Namecheap" : rr?.source === "dns" ? "DNS" : rr?.source === "registry" ? "Registry" : "—"}</TableCell>
                    <TableCell className="text-xs">
                      {o ? (
                        <div className="space-y-0.5">
                          <div className="font-medium">{o.accountName} · {o.registrar}</div>
                          <div className="text-muted-foreground">
                            Expires {o.expires ? new Date(o.expires).toLocaleDateString() : "—"}
                            {o.expiresInDays != null && (o.expiresInDays < 0
                              ? <Badge variant="destructive" className="ml-2">Expired</Badge>
                              : o.expiresInDays <= 30 ? <Badge variant="destructive" className="ml-2">Due in {o.expiresInDays}d</Badge>
                              : <span> · {o.expiresInDays} days left</span>)}
                          </div>
                        </div>
                      ) : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="text-right">
                      {s === "available" && <Button size="sm" variant="outline" asChild><a href={`https://www.namecheap.com/domains/registration/results/?domain=${d}`} target="_blank" rel="noreferrer">Register</a></Button>}
                      {s === "unknown" && <Button size="sm" variant="ghost" onClick={() => recheck(d)}><RefreshCw className="mr-1 h-3 w-3" />Recheck</Button>}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}

export const Route = createFileRoute("/_app/domain-checker")({
  head: () => ({
    meta: [
      { title: "Domain Checker — Alyson" },
      { name: "description", content: "Check the availability and portfolio status of a list of domains." },
      { property: "og:title", content: "Domain Checker — Alyson" },
      { property: "og:description", content: "Check the availability and portfolio status of a list of domains." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DomainCheckerPage,
});
