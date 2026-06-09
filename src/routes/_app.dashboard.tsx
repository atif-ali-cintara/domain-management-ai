import { createFileRoute } from "@tanstack/react-router";
import { Dashboard } from "@/components/dmd/Dashboard";

export const Route = createFileRoute("/_app/dashboard")({
  component: Dashboard,
});
