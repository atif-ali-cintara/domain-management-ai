import { createFileRoute, redirect } from "@tanstack/react-router";
import { AppShell } from "@/components/dmd/AppShell";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_app")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      throw redirect({ to: "/auth" });
    }
    if ((data.user.email ?? "").toLowerCase().split("@")[1] !== "cintara.ai") {
      await supabase.auth.signOut();
      throw redirect({ to: "/auth" });
    }
    return { user: data.user };
  },
  component: AppShell,
});
