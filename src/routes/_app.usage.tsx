import { createFileRoute } from "@tanstack/react-router";
import { Placeholder } from "./_app.domains";

export const Route = createFileRoute("/_app/usage")({
  component: () => <Placeholder title="usage" />,
});
