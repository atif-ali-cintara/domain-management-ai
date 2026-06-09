import { createFileRoute } from "@tanstack/react-router";
import { companies, domains } from "@/lib/migration-data";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

function CompaniesPage() {
  const counts = domains.reduce<Record<string, number>>((acc, d) => {
    acc[d.company] = (acc[d.company] ?? 0) + 1;
    return acc;
  }, {});
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Companies</h1>
        <p className="text-sm text-muted-foreground">
          {companies.length} companies imported from Migration Plan.
        </p>
      </div>
      <Card className="p-0 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Legal Company Name</TableHead>
              <TableHead>Trading Name</TableHead>
              <TableHead>Incorporation Owner</TableHead>
              <TableHead>Primary Domain</TableHead>
              <TableHead className="text-right">Domains</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {companies.map((c) => (
              <TableRow key={c.company + c.legal}>
                <TableCell className="font-medium">{c.legal || "—"}</TableCell>
                <TableCell>{c.company || "—"}</TableCell>
                <TableCell>{c.owner || <span className="text-muted-foreground">—</span>}</TableCell>
                <TableCell className="font-mono text-xs">{c.primary?.toLowerCase() || "—"}</TableCell>
                <TableCell className="text-right">
                  <Badge variant="secondary">{counts[c.legal] ?? 0}</Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

export const Route = createFileRoute("/_app/companies")({
  component: CompaniesPage,
});
