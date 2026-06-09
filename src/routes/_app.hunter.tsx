import { createFileRoute } from "@tanstack/react-router";
import { HunterPage } from "@/components/dmd/Hunter/HunterPage";

export const Route = createFileRoute("/_app/hunter")({
  component: HunterPage,
});
