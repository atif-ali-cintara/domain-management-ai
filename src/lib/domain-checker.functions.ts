import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { checkMany } from "@/lib/domain-hunter.functions";

const Input = z.object({
  domains: z.array(z.string().min(3).max(255).regex(/^[a-z0-9-]+(\.[a-z0-9-]+)+$/i)).min(1).max(25),
});

export const checkDomainList = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data }) => {
    const { results } = await checkMany(data.domains.map((d) => d.toLowerCase()), 3);
    return { results };
  });
