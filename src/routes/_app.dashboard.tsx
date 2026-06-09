import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { Dashboard } from "@/components/dmd/Dashboard";
import { getPortfolio } from "@/lib/portfolio.functions";

const portfolioQuery = queryOptions({
  queryKey: ["portfolio"],
  queryFn: () => getPortfolio(),
  staleTime: 5 * 60 * 1000,
});

function DashboardRoute() {
  const { data } = useSuspenseQuery(portfolioQuery);
  return <Dashboard portfolio={data} />;
}

export const Route = createFileRoute("/_app/dashboard")({
  loader: ({ context }) => context.queryClient.ensureQueryData(portfolioQuery),
  component: DashboardRoute,
  pendingComponent: () => (
    <div className="p-10 text-center text-sm text-muted-foreground">
      Loading domains from GoDaddy…
    </div>
  ),
  errorComponent: ({ error }) => (
    <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-sm">
      <div className="font-medium text-destructive">Could not load portfolio</div>
      <div className="mt-1 text-muted-foreground">{error.message}</div>
    </div>
  ),
});
