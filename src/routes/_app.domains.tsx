import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { domains } from "@/lib/migration-data";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

function Placeholder({ title }: { title: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center">
      <h1 className="text-xl font-semibold tracking-tight text-foreground">{title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        This module is part of Phase 1 and will be wired up next.
      </p>
    </div>
  );
}
export { Placeholder };

function DomainsPage() {
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return domains;
    return domains.filter(
      (d) =>
        d.domain.includes(needle) ||
        d.company.toLowerCase().includes(needle) ||
        d.owner.toLowerCase().includes(needle),
    );
  }, [q]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Domains</h1>
          <p className="text-sm text-muted-foreground">
            {domains.length} domains across all companies (primary + brands).
          </p>
        </div>
        <Input
          placeholder="Search domain, company, owner…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="max-w-xs"
        />
      </div>
      <Card className="p-0 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Domain</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Company</TableHead>
              <TableHead>Identity</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((d, i) => (
              <TableRow key={d.domain + i}>
                <TableCell className="font-mono text-xs">{d.domain}</TableCell>
                <TableCell>
                  <Badge variant={d.kind === "primary" ? "default" : "secondary"}>{d.kind}</Badge>
                </TableCell>
                <TableCell>{d.company || "—"}</TableCell>
                <TableCell>{d.owner || <span className="text-muted-foreground">—</span>}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

export const Route = createFileRoute("/_app/domains")({
  component: DomainsPage,
});
