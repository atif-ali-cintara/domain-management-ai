import { createFileRoute } from "@tanstack/react-router";
import { Placeholder } from "./_app.domains";

export const Route = createFileRoute("/_app/reports")({
  component: () => <Placeholder title="reports" />,
});
