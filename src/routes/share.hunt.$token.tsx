import { createFileRoute, notFound } from "@tanstack/react-router";
import { ExternalLink, ThumbsDown, ThumbsUp } from "lucide-react";
import { getSharedHunt } from "@/lib/saved-hunts.functions";

type R = { branchId: string; domain: string; available: boolean | null; price: number | null };
type B = { id: string; name: string; description?: string; keywords?: string[] };
type F = { id: string; text: string; rating: "up" | "down" | null; createdAt: number };
type H = {
  prompt?: string; inspiration?: string; selectedTlds?: string[]; maxBudget?: number; maxChars?: number;
  branches?: B[]; selectedBranchIds?: string[]; results?: R[]; cart?: string[]; feedback?: F[];
};

export const Route = createFileRoute("/share/hunt/$token")({
  loader: async ({ params }) => {
    const row = await getSharedHunt({ data: { token: params.token } });
    if (!row) throw notFound();
    return { name: row.name, updatedAt: row.updated_at, hunt: JSON.parse(row.data) as H };
  },
  head: ({ loaderData }) => {
    const title = loaderData ? `${loaderData.name} — Shared domain hunt` : "Shared domain hunt";
    const desc = "A read-only domain hunt shared from Alyson Domain Hunter.";
    return {
      meta: [
        { title }, { name: "description", content: desc },
        { property: "og:title", content: title }, { property: "og:description", content: desc },
        { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
        { name: "robots", content: "noindex" },
      ],
    };
  },
  notFoundComponent: () => (
    <div className="flex min-h-screen items-center justify-center p-6 text-center">
      <div>
        <h1 className="text-xl font-semibold">This link isn't available</h1>
        <p className="mt-2 text-sm text-muted-foreground">The hunt may have been unshared or deleted.</p>
      </div>
    </div>
  ),
  component: SharedHunt,
});

function SharedHunt() {
  const { name, updatedAt, hunt } = Route.useLoaderData();
  const branches = hunt.branches ?? [];
  const sel = new Set(hunt.selectedBranchIds ?? branches.map((b) => b.id));
  const available = (hunt.results ?? []).filter((r) => r.available === true);
  const cart = hunt.cart ?? [];

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b border-border bg-card px-6 py-4">
        <div className="mx-auto max-w-5xl">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Shared domain hunt · view only</div>
          <h1 className="text-2xl font-semibold">{name}</h1>
          <div className="text-xs text-muted-foreground">Last saved {new Date(updatedAt).toLocaleString()}</div>
        </div>
      </header>
      <main className="mx-auto grid max-w-5xl gap-6 px-6 py-6 lg:grid-cols-[1fr_300px]">
        <div className="min-w-0 space-y-6">
          <section className="rounded-xl border border-border bg-card p-5">
            <h2 className="mb-2 font-semibold">Brief</h2>
            <p className="whitespace-pre-wrap text-sm">{hunt.prompt || "—"}</p>
            {hunt.inspiration && <p className="mt-3 text-sm text-muted-foreground">Inspiration: {hunt.inspiration}</p>}
            <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
              {(hunt.selectedTlds ?? []).map((t) => <span key={t} className="rounded bg-muted px-2 py-0.5">{t}</span>)}
              {hunt.maxBudget ? <span>Max ${hunt.maxBudget}/yr</span> : null}
              {hunt.maxChars ? <span>Max {hunt.maxChars} chars</span> : null}
            </div>
          </section>

          {branches.filter((b) => sel.has(b.id)).map((b) => {
            const rows = available.filter((r) => r.branchId === b.id);
            return (
              <section key={b.id} className="rounded-xl border border-border bg-card p-5">
                <h3 className="font-semibold">{b.name}</h3>
                {b.description && <p className="mt-1 text-sm text-muted-foreground">{b.description}</p>}
                {rows.length === 0 ? (
                  <p className="mt-3 text-xs text-muted-foreground">No available domains found for this branch.</p>
                ) : (
                  <ul className="mt-3 grid gap-1 sm:grid-cols-2">
                    {rows.map((r) => (
                      <li key={r.domain} className="flex items-center justify-between gap-2 rounded-md border border-border bg-background px-2 py-1.5 text-xs">
                        <span className="truncate">{r.domain} <span className="text-muted-foreground">{r.domain.length}c</span></span>
                        <span className="flex items-center gap-2 text-muted-foreground">
                          {r.price != null ? `$${r.price.toFixed(2)}` : ""}
                          <a href={`https://www.namecheap.com/domains/registration/results/?domain=${encodeURIComponent(r.domain)}`} target="_blank" rel="noreferrer">
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            );
          })}

          {(hunt.feedback ?? []).length > 0 && (
            <section className="rounded-xl border border-border bg-card p-5">
              <h2 className="mb-2 font-semibold">Feedback</h2>
              <ul className="space-y-2">
                {hunt.feedback!.map((f) => (
                  <li key={f.id} className="flex gap-2 text-sm">
                    {f.rating === "up" ? <ThumbsUp className="h-4 w-4 shrink-0 text-primary" /> : f.rating === "down" ? <ThumbsDown className="h-4 w-4 shrink-0 text-destructive" /> : null}
                    <span>{f.text}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
        <aside className="h-fit space-y-4 lg:sticky lg:top-4">
          <div className="rounded-xl border border-border bg-card p-5">
            <h2 className="mb-2 font-semibold">Cart ({cart.length})</h2>
            {cart.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nothing in the cart.</p>
            ) : (
              <ul className="max-h-[40vh] space-y-1 overflow-y-auto text-xs">
                {cart.map((d) => <li key={d} className="rounded-md border border-border bg-background px-2 py-1.5">{d}</li>)}
              </ul>
            )}
          </div>
          <div className="rounded-xl border border-border bg-card p-5">
            <h2 className="mb-2 font-semibold">List ({available.length})</h2>
            {available.length === 0 ? (
              <p className="text-xs text-muted-foreground">No available domains.</p>
            ) : (
              <ul className="max-h-[40vh] space-y-1 overflow-y-auto text-xs">
                {available.map((r) => (
                  <li key={r.domain} className="flex justify-between gap-2 rounded-md border border-border bg-background px-2 py-1.5">
                    <span className="truncate">{r.domain}</span>
                    <span className="text-muted-foreground">{r.price != null ? `$${r.price.toFixed(2)}` : ""}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      </main>
    </div>
  );
}
