import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/dmd/AppShell";

export const Route = createFileRoute("/_app")({
  component: AppShell,
});
