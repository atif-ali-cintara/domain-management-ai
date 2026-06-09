import { createFileRoute } from "@tanstack/react-router";
import { identities, companies, domains } from "@/lib/migration-data";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

function IdentitiesPage() {
  const rows = identities.map((owner) => {
    const ownedCompanies = companies.filter((c) => c.owner === owner);
    const ownedDomains = domains.filter((d) => d.owner === owner);
    return { owner, companies: ownedCompanies, domains: ownedDomains };
  });
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Identities</h1>
        <p className="text-sm text-muted-foreground">
          {identities.length} incorporation owners across {companies.length} companies.
        </p>
      </div>
      <Card className="p-0 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Identity (Incorporation Owner)</TableHead>
              <TableHead>Companies</TableHead>
              <TableHead className="text-right"># Companies</TableHead>
              <TableHead className="text-right"># Domains</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.owner}>
                <TableCell className="font-medium">{r.owner}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {r.companies.map((c) => c.legal || c.company).join(", ") || "—"}
                </TableCell>
                <TableCell className="text-right">
                  <Badge variant="secondary">{r.companies.length}</Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Badge variant="secondary">{r.domains.length}</Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

export const Route = createFileRoute("/_app/identities")({
  component: IdentitiesPage,
});
