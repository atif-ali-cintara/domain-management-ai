import { createFileRoute } from "@tanstack/react-router";

function Placeholder({ title }: { title: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center">
      <h1 className="text-xl font-semibold tracking-tight text-foreground">{title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        This module is part of Phase 1 and will be wired up next. The dashboard above is the current focus.
      </p>
    </div>
  );
}

export { Placeholder };

export const Route = createFileRoute("/_app/domains")({
  component: () => <Placeholder title="Domains" />,
});
