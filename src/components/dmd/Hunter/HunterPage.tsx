import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Plus, X, Sparkles, Loader2, ExternalLink, ShoppingCart, Trash2, ListChecks, Play, RotateCw, MessageSquare, ThumbsUp, ThumbsDown } from "lucide-react";
import { mapBranches, runIteration, suggestTlds, recheckDomain, type Branch, type SuggestedTld } from "@/lib/domain-hunter.functions";

type TldDef = { tld: string; tier: 1 | 2 | 3 | 4; avg: number };
type TldGroup = { name: string; tlds: TldDef[] };

const DEFAULT_GROUPS: TldGroup[] = [
  {
    name: "Real estate & home",
    tlds: [
      { tld: ".house", tier: 2, avg: 25 },
      { tld: ".homes", tier: 2, avg: 30 },
      { tld: ".home", tier: 1, avg: 15 },
      { tld: ".realty", tier: 4, avg: 250 },
      { tld: ".realtor", tier: 2, avg: 40 },
      { tld: ".estate", tier: 2, avg: 35 },
      { tld: ".properties", tier: 2, avg: 35 },
      { tld: ".property", tier: 4, avg: 250 },
      { tld: ".rentals", tier: 2, avg: 35 },
      { tld: ".rent", tier: 3, avg: 80 },
      { tld: ".lease", tier: 2, avg: 35 },
      { tld: ".apartments", tier: 3, avg: 75 },
      { tld: ".condos", tier: 3, avg: 65 },
      { tld: ".villas", tier: 2, avg: 35 },
      { tld: ".farm", tier: 2, avg: 30 },
      { tld: ".land", tier: 2, avg: 30 },
    ],
  },
  {
    name: "Trades & services",
    tlds: [
      { tld: ".build", tier: 3, avg: 75 },
      { tld: ".builders", tier: 2, avg: 30 },
      { tld: ".construction", tier: 2, avg: 35 },
      { tld: ".contractors", tier: 2, avg: 35 },
      { tld: ".plumbing", tier: 2, avg: 35 },
      { tld: ".repair", tier: 2, avg: 30 },
      { tld: ".services", tier: 2, avg: 30 },
      { tld: ".solutions", tier: 2, avg: 30 },
      { tld: ".cleaning", tier: 2, avg: 35 },
      { tld: ".kitchen", tier: 2, avg: 35 },
      { tld: ".lighting", tier: 2, avg: 30 },
      { tld: ".garden", tier: 2, avg: 30 },
      { tld: ".tools", tier: 2, avg: 30 },
      { tld: ".supplies", tier: 2, avg: 30 },
      { tld: ".company", tier: 1, avg: 18 },
      { tld: ".pro", tier: 1, avg: 20 },
    ],
  },
  {
    name: "General",
    tlds: [
      { tld: ".com", tier: 1, avg: 12 },
      { tld: ".net", tier: 1, avg: 14 },
      { tld: ".org", tier: 1, avg: 14 },
      { tld: ".co", tier: 2, avg: 30 },
      { tld: ".us", tier: 1, avg: 10 },
      { tld: ".biz", tier: 1, avg: 18 },
      { tld: ".info", tier: 1, avg: 20 },
      { tld: ".xyz", tier: 1, avg: 12 },
      { tld: ".online", tier: 2, avg: 35 },
      { tld: ".site", tier: 2, avg: 30 },
      { tld: ".store", tier: 3, avg: 55 },
      { tld: ".shop", tier: 2, avg: 35 },
      { tld: ".club", tier: 1, avg: 15 },
      { tld: ".live", tier: 2, avg: 25 },
    ],
  },
  {
    name: "Tech",
    tlds: [
      { tld: ".io", tier: 3, avg: 60 },
      { tld: ".ai", tier: 3, avg: 90 },
      { tld: ".app", tier: 1, avg: 18 },
      { tld: ".dev", tier: 1, avg: 16 },
      { tld: ".tech", tier: 3, avg: 55 },
    ],
  },
];

const DEFAULT_SELECTED = [".com", ".services", ".house", ".homes"];

type Result = {
  branchId: string;
  domain: string;
  available: boolean | null;
  price: number | null;
  error?: string | null;
};

type FeedbackEntry = {
  id: string;
  text: string;
  rating: "up" | "down" | null;
  createdAt: number;
};

type Hunt = {
  id: string;
  name: string;
  prompt: string;
  inspiration: string;
  selectedTlds: string[];
  branchesToMap: number;
  maxBudget: number;
  maxChars: number;
  branches: Branch[];
  selectedBranchIds: string[];
  results: Result[];
  cart: string[];
  iterByBranch: Record<string, number>;
  customGroups: TldGroup[];
  feedback: FeedbackEntry[];
};

const STORAGE = "dmd.hunts.v1";

function newHunt(name = "Hunt 1"): Hunt {
  return {
    id: `h${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    name,
    prompt: "",
    inspiration: "",
    selectedTlds: [...DEFAULT_SELECTED],
    branchesToMap: 6,
    maxBudget: 50,
    maxChars: 0,
    branches: [],
    selectedBranchIds: [],
    results: [],
    cart: [],
    iterByBranch: {},
    customGroups: [],
    feedback: [],
  };
}

function tierDollars(t: number): string {
  return "$".repeat(Math.max(1, Math.min(4, t)));
}
function tierColor(t: number): string {
  return ["text-emerald-500", "text-blue-500", "text-amber-500", "text-rose-500"][Math.max(0, Math.min(3, t - 1))];
}

export function HunterPage() {
  const [hunts, setHunts] = useState<Hunt[]>([newHunt()]);
  const [activeId, setActiveId] = useState<string>("");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE);
      if (raw) {
        const parsed = JSON.parse(raw) as { hunts: Hunt[]; activeId: string };
        if (parsed?.hunts?.length) {
          // Backfill fields added after this hunt was persisted.
          const normalized = parsed.hunts.map((h) => ({
            ...h,
            selectedBranchIds: h.selectedBranchIds ?? (h.branches?.map((b) => b.id) ?? []),
            feedback: h.feedback ?? [],
          }));
          setHunts(normalized);
          setActiveId(parsed.activeId || normalized[0].id);
          setHydrated(true);
          return;
        }
      }
    } catch {
      /* ignore */
    }
    setActiveId((curr) => curr || hunts[0].id);
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE, JSON.stringify({ hunts, activeId }));
    } catch {
      /* ignore */
    }
  }, [hunts, activeId, hydrated]);

  const active = hunts.find((h) => h.id === activeId) ?? hunts[0];

  function updateActive(patch: Partial<Hunt> | ((h: Hunt) => Partial<Hunt>)) {
    setHunts((prev) =>
      prev.map((h) => (h.id === active.id ? { ...h, ...(typeof patch === "function" ? patch(h) : patch) } : h)),
    );
  }

  return (
    <div className="-mx-6 -my-6 min-h-[calc(100vh-4rem)] bg-muted/30">
      <div className="flex items-center gap-1 border-b border-border bg-card px-3 pt-2">
        <div className="flex flex-1 items-center gap-1 overflow-x-auto">
          {hunts.map((h) => {
            const isActive = h.id === active.id;
            return (
              <div
                key={h.id}
                className={[
                  "group flex shrink-0 items-center gap-2 rounded-t-md border-t border-l border-r px-3 py-1.5 text-xs transition",
                  isActive
                    ? "border-border bg-background font-semibold text-foreground"
                    : "border-transparent text-muted-foreground hover:bg-muted",
                ].join(" ")}
              >
                <button onClick={() => setActiveId(h.id)} className="flex items-center gap-2">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-400" />
                  <span className="max-w-[180px] truncate">{h.name}</span>
                </button>
                {hunts.length > 1 && (
                  <button
                    onClick={() => {
                      setHunts((prev) => {
                        const next = prev.filter((x) => x.id !== h.id);
                        if (h.id === activeId && next.length) setActiveId(next[0].id);
                        return next;
                      });
                    }}
                    className="text-muted-foreground/60 opacity-0 transition hover:text-foreground group-hover:opacity-100"
                    title="Close hunt"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            );
          })}
          <button
            onClick={() => {
              const h = newHunt(`Hunt ${hunts.length + 1}`);
              setHunts((p) => [...p, h]);
              setActiveId(h.id);
            }}
            className="ml-1 inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1.5 text-xs font-medium text-muted-foreground transition hover:bg-accent hover:text-foreground"
          >
            <Plus className="h-3.5 w-3.5" />
            New hunt
          </button>
        </div>
      </div>

      <div className="grid gap-6 px-6 py-6 lg:grid-cols-[1fr_360px]">
        <HuntWorkspace key={active.id} hunt={active} update={updateActive} />
        <CartPanel hunt={active} update={updateActive} />
      </div>
    </div>
  );
}

function HuntWorkspace({ hunt, update }: { hunt: Hunt; update: (p: Partial<Hunt> | ((h: Hunt) => Partial<Hunt>)) => void }) {
  const [renaming, setRenaming] = useState(false);
  const [mapping, setMapping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hunting, setHunting] = useState(false);
  const [stopFlag, setStopFlag] = useState(false);
  const [iterationsPerBranch, setIterationsPerBranch] = useState(3);
  const [huntBatchSize, setHuntBatchSize] = useState(10);
  const [huntProgress, setHuntProgress] = useState<{ done: number; total: number }>({ done: 0, total: 0 });
  const map = useServerFn(mapBranches);
  const run = useServerFn(runIteration);

  const allTlds = useMemo(() => {
    const out = new Map<string, TldDef>();
    for (const g of DEFAULT_GROUPS) for (const t of g.tlds) out.set(t.tld, t);
    for (const g of hunt.customGroups) for (const t of g.tlds) out.set(t.tld, t);
    return out;
  }, [hunt.customGroups]);

  function toggleTld(tld: string) {
    update((h) => ({
      selectedTlds: h.selectedTlds.includes(tld) ? h.selectedTlds.filter((t) => t !== tld) : [...h.selectedTlds, tld],
    }));
  }

  async function doMap() {
    if (!hunt.prompt.trim()) {
      setError("Add a brief first.");
      return;
    }
    setError(null);
    setMapping(true);
    try {
      const res = await map({
        data: { prompt: hunt.prompt, count: hunt.branchesToMap, inspiration: hunt.inspiration || undefined },
      });
      update({ branches: res.branches, selectedBranchIds: res.branches.map((b) => b.id), results: [], iterByBranch: {} });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to map branches");
    } finally {
      setMapping(false);
    }
  }

  async function doHuntAll() {
    const selectedSet = new Set(hunt.selectedBranchIds);
    const branches = hunt.branches.filter((b) => selectedSet.has(b.id));
    if (branches.length === 0) return;
    setError(null);
    setStopFlag(false);
    setHunting(true);
    const total = branches.length * iterationsPerBranch;
    setHuntProgress({ done: 0, total });
    let done = 0;
    try {
      for (let i = 0; i < iterationsPerBranch; i++) {
        if (stopFlag) break;
        await Promise.all(
          branches.map(async (branch) => {
            if (stopFlag) return;
            // Read latest hunt state via functional update trick
            let historySnapshot: { domain: string; available: boolean | null; price: number | null }[] = [];
            let iterSnapshot = 0;
            update((h) => {
              historySnapshot = h.results
                .filter((r) => r.branchId === branch.id)
                .map((r) => ({ domain: r.domain, available: r.available, price: r.price }));
              iterSnapshot = h.iterByBranch[branch.id] ?? 0;
              return {};
            });
            try {
              const res = await run({
                data: {
                  prompt: hunt.prompt,
                  iteration: iterSnapshot + 1,
                  history: historySnapshot,
                  tlds: hunt.selectedTlds,
                  batchSize: huntBatchSize,
                  branchName: branch.name,
                  branchKeywords: branch.keywords,
                  branchDescription: branch.description,
                  inspiration: hunt.inspiration || undefined,
                  maxLength: hunt.maxChars > 0 ? hunt.maxChars : undefined,
                },
              });
              update((h) => ({
                results: [
                  ...h.results,
                  ...res.results.map((r) => ({
                    branchId: branch.id,
                    domain: r.domain,
                    available: r.available,
                    price: r.price,
                    error: r.error,
                  })),
                ],
                iterByBranch: { ...h.iterByBranch, [branch.id]: (h.iterByBranch[branch.id] ?? 0) + 1 },
              }));
            } catch (e) {
              setError(e instanceof Error ? e.message : "Iteration failed");
            } finally {
              done += 1;
              setHuntProgress({ done, total });
            }
          }),
        );
      }
    } finally {
      setHunting(false);
      setStopFlag(false);
    }
  }


  return (
    <div className="min-w-0 space-y-6">
      <div className="flex items-center justify-between">
        {renaming ? (
          <input
            autoFocus
            defaultValue={hunt.name}
            onBlur={(e) => {
              update({ name: e.target.value.trim() || hunt.name });
              setRenaming(false);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              if (e.key === "Escape") setRenaming(false);
            }}
            className="rounded-md border border-border bg-background px-2 py-1 text-xl font-semibold"
          />
        ) : (
          <h1 className="text-xl font-semibold" onDoubleClick={() => setRenaming(true)} title="Double-click to rename">
            {hunt.name}
          </h1>
        )}
      </div>

      <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <div className="mb-4">
          <h2 className="text-base font-semibold">Brief</h2>
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            Describe what you're naming. We'll map semantic angles and hunt domains across each.
          </p>
        </div>
        <textarea
          value={hunt.prompt}
          onChange={(e) => update({ prompt: e.target.value })}
          rows={3}
          placeholder="e.g. A national home-services platform connecting homeowners with vetted local pros."
          className="w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
        />

        <div className="mt-5">
          <label className="text-sm font-medium">
            Inspiration <span className="text-xs text-muted-foreground">(optional — keywords or example domains you like, comma-separated)</span>
          </label>
          <textarea
            value={hunt.inspiration}
            onChange={(e) => update({ inspiration: e.target.value })}
            rows={2}
            placeholder="e.g. stripe.com, linear.app, calm, swift, nimble"
            className="mt-1 w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>

        <TldPicker
          allTlds={allTlds}
          selected={hunt.selectedTlds}
          customGroups={hunt.customGroups}
          onToggle={toggleTld}
          onSelectAll={(group) => {
            const set = new Set(hunt.selectedTlds);
            for (const t of group.tlds) set.add(t.tld);
            update({ selectedTlds: Array.from(set) });
          }}
          onClearAll={() => update({ selectedTlds: [] })}
          onAddCustom={(tld, avg) => {
            const norm = tld.startsWith(".") ? tld.toLowerCase() : "." + tld.toLowerCase();
            if (!/^\.[a-z]{2,}$/.test(norm)) return;
            if (allTlds.has(norm)) {
              if (!hunt.selectedTlds.includes(norm))
                update((h) => ({ selectedTlds: [...h.selectedTlds, norm] }));
              return;
            }
            update((h) => {
              const customIdx = h.customGroups.findIndex((g) => g.name === "Custom");
              const def: TldDef = { tld: norm, tier: avg >= 100 ? 4 : avg >= 50 ? 3 : avg >= 25 ? 2 : 1, avg };
              const customGroups =
                customIdx >= 0
                  ? h.customGroups.map((g, i) => (i === customIdx ? { ...g, tlds: [...g.tlds, def] } : g))
                  : [...h.customGroups, { name: "Custom", tlds: [def] }];
              return {
                customGroups,
                selectedTlds: h.selectedTlds.includes(norm) ? h.selectedTlds : [...h.selectedTlds, norm],
              };
            });
          }}
          prompt={hunt.prompt}
          inspiration={hunt.inspiration}
        />

        <div className="mt-6 grid gap-4 sm:grid-cols-[1fr_180px_220px_auto] sm:items-end">
          <div>
            <label className="text-sm font-medium">
              Branches to map: <span className="font-semibold">{hunt.branchesToMap}</span>
            </label>
            <input
              type="range"
              min={3}
              max={10}
              value={hunt.branchesToMap}
              onChange={(e) => update({ branchesToMap: parseInt(e.target.value) })}
              className="mt-2 w-full accent-primary"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Max $/yr budget</label>
            <input
              type="number"
              min={1}
              value={hunt.maxBudget}
              onChange={(e) => update({ maxBudget: Math.max(0, parseInt(e.target.value) || 0) })}
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-sm font-medium">
              Max chars <span className="text-xs text-muted-foreground">(name + TLD, 0 = no limit)</span>
            </label>
            <input
              type="number"
              min={0}
              value={hunt.maxChars}
              onChange={(e) => update({ maxChars: Math.max(0, parseInt(e.target.value) || 0) })}
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
          </div>
          <button
            onClick={doMap}
            disabled={mapping || !hunt.prompt.trim() || hunt.selectedTlds.length === 0}
            className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {mapping ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Map semantic branches
          </button>
        </div>
        {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}
      </section>

      {hunt.branches.length > 0 && (
        <section className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3 rounded-xl border border-border bg-card p-4 shadow-sm">
            <div>
              <h2 className="text-base font-semibold">Hunt across all branches</h2>
              <p className="mt-0.5 text-[13px] text-muted-foreground">
                Runs iterations in parallel across every branch. Only on-budget, on-brief hits populate the list on the right.
              </p>
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <label className="text-xs text-muted-foreground">
                Iterations / branch
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={iterationsPerBranch}
                  onChange={(e) => setIterationsPerBranch(Math.max(1, Math.min(20, parseInt(e.target.value) || 1)))}
                  disabled={hunting}
                  className="ml-1 w-16 rounded-md border border-border bg-background px-2 py-1 text-xs"
                />
              </label>
              <label className="text-xs text-muted-foreground">
                Batch
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={huntBatchSize}
                  onChange={(e) => setHuntBatchSize(Math.max(1, Math.min(20, parseInt(e.target.value) || 10)))}
                  disabled={hunting}
                  className="ml-1 w-14 rounded-md border border-border bg-background px-2 py-1 text-xs"
                />
              </label>
              {hunting ? (
                <>
                  <span className="text-xs text-muted-foreground">
                    {huntProgress.done}/{huntProgress.total}
                  </span>
                  <button
                    onClick={() => setStopFlag(true)}
                    className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium hover:bg-muted"
                  >
                    <X className="h-4 w-4" /> Stop
                  </button>
                </>
              ) : (
                <button
                  onClick={doHuntAll}
                  disabled={hunt.selectedTlds.length === 0}
                  className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
                >
                  <Play className="h-4 w-4" /> Start hunt
                </button>
              )}
            </div>
          </div>
          {hunt.branches.map((b) => (
            <BranchCard key={b.id} hunt={hunt} branch={b} update={update} allTlds={allTlds} />
          ))}
        </section>
      )}
    </div>
  );
}

function TldPicker({
  allTlds,
  selected,
  customGroups,
  onToggle,
  onSelectAll,
  onClearAll,
  onAddCustom,
  prompt,
  inspiration,
}: {
  allTlds: Map<string, TldDef>;
  selected: string[];
  customGroups: TldGroup[];
  onToggle: (tld: string) => void;
  onSelectAll: (g: TldGroup) => void;
  onClearAll: () => void;
  onAddCustom: (tld: string, avg: number) => void;
  prompt: string;
  inspiration: string;
}) {
  const [adding, setAdding] = useState(false);
  const [search, setSearch] = useState("");
  const [suggesting, setSuggesting] = useState(false);
  const [suggested, setSuggested] = useState<SuggestedTld[]>([]);
  const suggest = useServerFn(suggestTlds);

  async function doSuggest(q: string) {
    setSuggesting(true);
    try {
      const known = Array.from(allTlds.keys());
      const res = await suggest({
        data: {
          prompt: prompt || inspiration || undefined,
          query: q || undefined,
          exclude: known,
          count: 8,
        },
      });
      setSuggested(res.tlds);
    } finally {
      setSuggesting(false);
    }
  }

  const groups = [...DEFAULT_GROUPS, ...customGroups];

  return (
    <div className="mt-5">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          TLDs · {selected.length} selected
        </div>
        <button onClick={onClearAll} className="text-xs text-muted-foreground hover:text-foreground">
          Clear all
        </button>
      </div>
      <div className="space-y-3">
        {groups.map((g) => (
          <div key={g.name}>
            <div className="mb-1 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              {g.name}
              <button onClick={() => onSelectAll(g)} className="font-medium text-muted-foreground/80 hover:text-foreground">
                select all
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {g.tlds.map((t) => {
                const on = selected.includes(t.tld);
                return (
                  <button
                    key={t.tld}
                    onClick={() => onToggle(t.tld)}
                    title={`~$${t.avg}/yr`}
                    className={[
                      "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition",
                      on
                        ? "border-primary bg-primary/10 text-foreground"
                        : "border-border bg-background text-foreground hover:bg-muted",
                    ].join(" ")}
                  >
                    <span>{t.tld}</span>
                    <span className={tierColor(t.tier)}>{tierDollars(t.tier)}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        {suggested.length > 0 && (
          <div>
            <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Suggested</div>
            <div className="flex flex-wrap gap-1.5">
              {suggested.map((s) => (
                <button
                  key={s.tld}
                  onClick={() => {
                    onAddCustom(s.tld, s.avg);
                    setSuggested((prev) => prev.filter((x) => x.tld !== s.tld));
                  }}
                  title={s.reason || `~$${s.avg}/yr`}
                  className="inline-flex items-center gap-1 rounded-full border border-dashed border-border bg-background px-2.5 py-1 text-xs hover:bg-muted"
                >
                  <Plus className="h-3 w-3" /> {s.tld} <span className="text-muted-foreground">${s.avg}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          {adding ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const data = new FormData(e.currentTarget);
                const tld = String(data.get("tld") || "");
                const avg = parseInt(String(data.get("avg") || "30"));
                if (tld) onAddCustom(tld, avg);
                setAdding(false);
              }}
              className="flex items-center gap-1.5"
            >
              <input
                name="tld"
                autoFocus
                placeholder=".custom"
                className="w-28 rounded-md border border-border bg-background px-2 py-1 text-xs"
              />
              <input
                name="avg"
                type="number"
                defaultValue={30}
                title="Estimated $/yr"
                className="w-16 rounded-md border border-border bg-background px-2 py-1 text-xs"
              />
              <button type="submit" className="rounded-md bg-primary px-2 py-1 text-xs text-primary-foreground">
                Add
              </button>
              <button type="button" onClick={() => setAdding(false)} className="text-xs text-muted-foreground">
                Cancel
              </button>
            </form>
          ) : (
            <button onClick={() => setAdding(true)} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
              <Plus className="h-3 w-3" /> add
            </button>
          )}

          <div className="flex items-center gap-1.5">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search more TLDs (AI)"
              className="w-44 rounded-md border border-border bg-background px-2 py-1 text-xs"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  doSuggest(search);
                }
              }}
            />
            <button
              onClick={() => doSuggest(search)}
              disabled={suggesting}
              className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-xs hover:bg-muted disabled:opacity-50"
            >
              {suggesting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
              Suggest
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function BranchCard({
  hunt,
  branch,
  update,
  allTlds,
}: {
  hunt: Hunt;
  branch: Branch;
  update: (p: Partial<Hunt> | ((h: Hunt) => Partial<Hunt>)) => void;
  allTlds: Map<string, TldDef>;
}) {
  const [running, setRunning] = useState(false);
  const [batchSize, setBatchSize] = useState(10);
  const [error, setError] = useState<string | null>(null);
  const [rechecking, setRechecking] = useState<Set<string>>(new Set());
  const run = useServerFn(runIteration);
  const recheck = useServerFn(recheckDomain);

  async function doRecheck(domain: string) {
    setRechecking((s) => new Set(s).add(domain));
    try {
      const { result } = await recheck({ data: { domain } });
      update((h) => ({
        results: h.results.map((r) =>
          r.branchId === branch.id && r.domain === domain
            ? { ...r, available: result.available, price: result.price, error: result.error ?? null }
            : r
        ),
      }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Recheck failed");
    } finally {
      setRechecking((s) => {
        const next = new Set(s);
        next.delete(domain);
        return next;
      });
    }
  }


  const branchResults = hunt.results.filter((r) => r.branchId === branch.id);
  const availableCount = branchResults.filter((r) => r.available === true).length;
  const iter = hunt.iterByBranch[branch.id] ?? 0;

  async function doRun() {
    setRunning(true);
    setError(null);
    try {
      const history = branchResults.map((r) => ({ domain: r.domain, available: r.available, price: r.price }));
      const res = await run({
        data: {
          prompt: hunt.prompt,
          iteration: iter + 1,
          history,
          tlds: hunt.selectedTlds,
          batchSize,
          branchName: branch.name,
          branchKeywords: branch.keywords,
          branchDescription: branch.description,
          inspiration: hunt.inspiration || undefined,
          maxLength: hunt.maxChars > 0 ? hunt.maxChars : undefined,
        },
      });
      update((h) => ({
        results: [
          ...h.results,
          ...res.results.map((r) => ({
            branchId: branch.id,
            domain: r.domain,
            available: r.available,
            price: r.price,
            error: r.error,
          })),
        ],
        iterByBranch: { ...h.iterByBranch, [branch.id]: iter + 1 },
      }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to run iteration");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold">{branch.name}</h3>
            <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
              iter {iter} · {branchResults.length} tried · {availableCount} available
            </span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{branch.description}</p>
          <div className="mt-2 flex flex-wrap gap-1">
            {branch.keywords.map((k) => (
              <span key={k} className="rounded-md bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
                {k}
              </span>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-muted-foreground">
            Batch
            <input
              type="number"
              min={1}
              max={20}
              value={batchSize}
              onChange={(e) => setBatchSize(Math.max(1, Math.min(20, parseInt(e.target.value) || 10)))}
              className="ml-1 w-14 rounded-md border border-border bg-background px-2 py-1 text-xs"
            />
          </label>
          <button
            onClick={doRun}
            disabled={running}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            Run iteration
          </button>
        </div>
      </div>

      {error && <p className="mt-2 text-sm text-rose-600">{error}</p>}

      {branchResults.length > 0 && (
        <ul className="mt-4 divide-y divide-border">
          {branchResults.map((r) => {
            const tld = "." + r.domain.split(".").slice(1).join(".");
            const def = allTlds.get(tld);
            const annualEst = def?.avg ?? null;
            const overBudget = annualEst != null && annualEst > hunt.maxBudget;
            const overChars = hunt.maxChars > 0 && r.domain.length > hunt.maxChars;
            const inCart = hunt.cart.includes(r.domain);
            const isUnknown = r.available === null;
            const isBusy = rechecking.has(r.domain);
            return (
              <li key={r.domain + r.branchId} className={`flex items-center justify-between gap-3 py-2 text-sm ${isUnknown ? "opacity-70" : ""}`}>
                <div className="flex min-w-0 items-center gap-2">
                  <input
                    type="checkbox"
                    disabled={r.available !== true || overBudget || overChars}
                    checked={inCart}
                    onChange={(e) =>
                      update((h) => ({
                        cart: e.target.checked ? Array.from(new Set([...h.cart, r.domain])) : h.cart.filter((d) => d !== r.domain),
                      }))
                    }
                  />
                  <span className="truncate font-medium">{r.domain}</span>
                  <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground" title="Character count (including TLD)">{r.domain.length} chars</span>
                  {r.available === true && <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] text-emerald-600">available</span>}
                  {r.available === false && <span className="rounded-full bg-rose-500/10 px-2 py-0.5 text-[11px] text-rose-600">taken</span>}
                  {isUnknown && (
                    <span
                      className="rounded-full bg-slate-500/10 px-2 py-0.5 text-[11px] text-slate-500"
                      title={r.error ?? "Availability lookup didn't return a definitive answer — click Recheck."}
                    >
                      unknown{r.error ? ` · ${r.error}` : ""}
                    </span>
                  )}
                  {overBudget && <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] text-amber-600">over budget</span>}
                  {overChars && <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] text-amber-600">too long</span>}
                </div>
                <div className="flex shrink-0 items-center gap-3 text-xs text-muted-foreground">
                  <span>{r.price != null ? `$${r.price.toFixed(2)}` : annualEst != null ? `~$${annualEst}` : "—"}</span>
                  {isUnknown && (
                    <button
                      onClick={() => doRecheck(r.domain)}
                      disabled={isBusy}
                      className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-0.5 text-[11px] hover:bg-muted disabled:opacity-50"
                      title="Retry the availability lookup"
                    >
                      {isBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCw className="h-3 w-3" />}
                      Recheck
                    </button>
                  )}
                  <a
                    href={`https://www.namecheap.com/domains/registration/results/?domain=${encodeURIComponent(r.domain)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 hover:text-foreground"
                    title="Register on Namecheap"
                  >
                    Namecheap <ExternalLink className="h-3 w-3" />
                  </a>
                  <a
                    href={`https://www.godaddy.com/domainsearch/find?domainToCheck=${encodeURIComponent(r.domain)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 opacity-60 hover:opacity-100 hover:text-foreground"
                    title="Compare on GoDaddy"
                  >
                    GoDaddy <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </li>
            );
          })}
        </ul>
      )}

    </div>
  );
}

function CartPanel({ hunt, update }: { hunt: Hunt; update: (p: Partial<Hunt> | ((h: Hunt) => Partial<Hunt>)) => void }) {
  const [tab, setTab] = useState<"list" | "cart">("list");

  const allTlds = useMemo(() => {
    const out = new Map<string, TldDef>();
    for (const g of DEFAULT_GROUPS) for (const t of g.tlds) out.set(t.tld, t);
    for (const g of hunt.customGroups) for (const t of g.tlds) out.set(t.tld, t);
    return out;
  }, [hunt.customGroups]);

  const candidates = useMemo(() => {
    return hunt.results
      .filter((r) => r.available === true)
      .filter((r) => {
        if (hunt.maxChars > 0 && r.domain.length > hunt.maxChars) return false;
        if (hunt.maxBudget > 0) {
          const tld = "." + r.domain.split(".").slice(1).join(".");
          const est = r.price ?? allTlds.get(tld)?.avg ?? null;
          if (est != null && est > hunt.maxBudget) return false;
        }
        return true;
      });
  }, [hunt.results, hunt.maxChars, hunt.maxBudget, allTlds]);

  const byBranch = useMemo(() => {
    const out: Record<string, Result[]> = {};
    for (const c of candidates) {
      (out[c.branchId] ??= []).push(c);
    }
    return out;
  }, [candidates]);

  return (
    <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
      <div className="rounded-xl border border-border bg-card shadow-sm">
        <div className="flex items-center gap-4 border-b border-border px-4 pt-3">
          <button
            onClick={() => setTab("list")}
            className={[
              "flex items-center gap-1.5 border-b-2 pb-2.5 text-sm font-medium transition-colors",
              tab === "list" ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
            ].join(" ")}
          >
            <ListChecks className="h-4 w-4" /> List <span className="text-xs text-muted-foreground">{candidates.length}</span>
          </button>
          <button
            onClick={() => setTab("cart")}
            className={[
              "flex items-center gap-1.5 border-b-2 pb-2.5 text-sm font-medium transition-colors",
              tab === "cart" ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
            ].join(" ")}
          >
            <ShoppingCart className="h-4 w-4" /> Cart <span className="text-xs text-muted-foreground">{hunt.cart.length}</span>
          </button>
        </div>

        <div className="p-4">
          {tab === "list" ? (
            candidates.length === 0 ? (
              <div className="py-10 text-center">
                <ListChecks className="mx-auto h-6 w-6 text-muted-foreground" />
                <p className="mt-3 text-xs text-muted-foreground">
                  No candidates yet. Hits will appear here as the hunt runs.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {hunt.branches
                  .filter((b) => byBranch[b.id]?.length)
                  .map((b) => (
                    <div key={b.id}>
                      <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{b.name}</div>
                      <ul className="space-y-1">
                        {byBranch[b.id].map((r) => {
                          const inCart = hunt.cart.includes(r.domain);
                          return (
                            <li key={r.domain} className="flex items-center justify-between gap-2 rounded-md border border-border bg-background px-2 py-1.5 text-xs">
                              <label className="flex min-w-0 items-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={inCart}
                                  onChange={(e) =>
                                    update((h) => ({
                                      cart: e.target.checked ? Array.from(new Set([...h.cart, r.domain])) : h.cart.filter((d) => d !== r.domain),
                                    }))
                                  }
                                />
                                <span className="truncate">{r.domain}</span>
                                <span className="shrink-0 text-[10px] text-muted-foreground">{r.domain.length}c</span>
                              </label>
                              <span className="shrink-0 text-muted-foreground">
                                {r.price != null ? `$${r.price.toFixed(2)}` : ""}
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  ))}
              </div>
            )
          ) : hunt.cart.length === 0 ? (
            <div className="py-10 text-center">
              <ShoppingCart className="mx-auto h-6 w-6 text-muted-foreground" />
              <p className="mt-3 text-xs text-muted-foreground">Cart is empty. Tick candidates to add them.</p>
            </div>
          ) : (
            <div className="space-y-2">
              <ul className="space-y-1">
                {hunt.cart.map((d) => (
                  <li key={d} className="flex items-center justify-between gap-2 rounded-md border border-border bg-background px-2 py-1.5 text-xs">
                    <span className="truncate">{d}</span>
                    <button
                      onClick={() => update((h) => ({ cart: h.cart.filter((x) => x !== d) }))}
                      className="text-muted-foreground hover:text-rose-600"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => update({ cart: [] })}
                  className="flex-1 rounded-md border border-border bg-background px-2 py-1.5 text-xs hover:bg-muted"
                >
                  Clear
                </button>
                <a
                  href={`https://www.namecheap.com/domains/registration/results/?type=beast&domain-list=${encodeURIComponent(hunt.cart.join("\n"))}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex-1 rounded-md bg-primary px-2 py-1.5 text-center text-xs font-medium text-primary-foreground"
                >
                  Register on Namecheap
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
