import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useRef, useState } from "react";
import {
  Activity,
  Check,
  ChevronRight,
  ClipboardCopy,
  Compass,
  Globe2,
  LayoutGrid,
  ListChecks,
  Plus,
  Search,
  Settings,
  ShoppingCart,
  Sparkles,
  Square,
  Target,
  Trash2,
  TrendingUp,
  X,
} from "lucide-react";
import { mapBranches, runIteration, suggestTlds, type Branch, type SuggestedTld } from "@/lib/domain-hunter.functions";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Domain Hunter — Semantic Branch Search" },
      {
        name: "description",
        content:
          "Map semantic brand angles, then hunt available domains per branch until you hit your target.",
      },
    ],
  }),
  component: Index,
});

type Row = {
  domain: string;
  available: boolean | null;
  price: number | null;
  currency?: string | null;
  error?: string | null;
  iteration: number;
};

type BranchState = {
  target: number;
  enabled: boolean;
  status: "idle" | "running" | "done" | "stopped" | "exhausted" | "error";
  tried: Row[];
  iterations: number;
  consecutiveZero: number;
  errorMsg?: string;
};

type Phase = "setup" | "mapping" | "configure" | "hunting" | "done";

type Hunt = {
  id: string;
  title: string;
  createdAt: number;
  prompt: string;
  inspiration: string;
  selectedTlds: string[];
  customTld: string;
  suggestedTlds: SuggestedTld[];
  tldSearch: string;
  tldSuggesting: boolean;
  tldAutoSuggested: boolean;
  maxPrice: number;
  maxLength: number;
  branchCount: number;
  branches: Branch[];
  branchState: Record<string, BranchState>;
  phase: Phase;
  globalStatus: string;
  expanded: string | null;
};

type CartItem = {
  domain: string;
  price: number | null;
  huntId: string;
  huntTitle: string;
  branchId: string;
  branchName: string;
};

const TLD_CATALOG: { tld: string; avg: number; group: string }[] = [
  { tld: ".house", avg: 35, group: "Real estate & home" },
  { tld: ".homes", avg: 45, group: "Real estate & home" },
  { tld: ".home", avg: 40, group: "Real estate & home" },
  { tld: ".realty", avg: 200, group: "Real estate & home" },
  { tld: ".realtor", avg: 40, group: "Real estate & home" },
  { tld: ".estate", avg: 35, group: "Real estate & home" },
  { tld: ".properties", avg: 35, group: "Real estate & home" },
  { tld: ".property", avg: 200, group: "Real estate & home" },
  { tld: ".rentals", avg: 35, group: "Real estate & home" },
  { tld: ".rent", avg: 90, group: "Real estate & home" },
  { tld: ".lease", avg: 50, group: "Real estate & home" },
  { tld: ".apartments", avg: 55, group: "Real estate & home" },
  { tld: ".condos", avg: 55, group: "Real estate & home" },
  { tld: ".villas", avg: 35, group: "Real estate & home" },
  { tld: ".farm", avg: 30, group: "Real estate & home" },
  { tld: ".land", avg: 35, group: "Real estate & home" },
  { tld: ".build", avg: 65, group: "Trades & services" },
  { tld: ".builders", avg: 30, group: "Trades & services" },
  { tld: ".construction", avg: 35, group: "Trades & services" },
  { tld: ".contractors", avg: 30, group: "Trades & services" },
  { tld: ".plumbing", avg: 50, group: "Trades & services" },
  { tld: ".repair", avg: 30, group: "Trades & services" },
  { tld: ".services", avg: 30, group: "Trades & services" },
  { tld: ".solutions", avg: 30, group: "Trades & services" },
  { tld: ".cleaning", avg: 50, group: "Trades & services" },
  { tld: ".kitchen", avg: 50, group: "Trades & services" },
  { tld: ".lighting", avg: 30, group: "Trades & services" },
  { tld: ".garden", avg: 35, group: "Trades & services" },
  { tld: ".tools", avg: 30, group: "Trades & services" },
  { tld: ".supplies", avg: 30, group: "Trades & services" },
  { tld: ".company", avg: 25, group: "Trades & services" },
  { tld: ".pro", avg: 25, group: "Trades & services" },
  { tld: ".com", avg: 22, group: "General" },
  { tld: ".net", avg: 22, group: "General" },
  { tld: ".org", avg: 22, group: "General" },
  { tld: ".co", avg: 35, group: "General" },
  { tld: ".us", avg: 15, group: "General" },
  { tld: ".biz", avg: 22, group: "General" },
  { tld: ".info", avg: 22, group: "General" },
  { tld: ".xyz", avg: 15, group: "General" },
  { tld: ".online", avg: 40, group: "General" },
  { tld: ".site", avg: 30, group: "General" },
  { tld: ".store", avg: 60, group: "General" },
  { tld: ".shop", avg: 40, group: "General" },
  { tld: ".club", avg: 20, group: "General" },
  { tld: ".live", avg: 30, group: "General" },
  { tld: ".io", avg: 60, group: "Tech" },
  { tld: ".ai", avg: 100, group: "Tech" },
  { tld: ".app", avg: 25, group: "Tech" },
  { tld: ".dev", avg: 20, group: "Tech" },
  { tld: ".tech", avg: 60, group: "Tech" },
];
const TLD_PRESETS = TLD_CATALOG.map((t) => t.tld);
function priceBucket(avg: number): { label: string; tone: string } {
  if (avg <= 25) return { label: "$", tone: "text-emerald-400" };
  if (avg <= 50) return { label: "$$", tone: "text-cyan-400" };
  if (avg <= 100) return { label: "$$$", tone: "text-amber-400" };
  return { label: "$$$$", tone: "text-rose-400" };
}
const TLD_GROUPS = Array.from(new Set(TLD_CATALOG.map((t) => t.group)));

const MAX_ITERATIONS_PER_BRANCH = 25;
const GIVE_UP_AFTER_ZERO_HITS = 6;

function newHunt(seq: number): Hunt {
  return {
    id: `h_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    title: `Hunt ${seq}`,
    createdAt: Date.now(),
    prompt: "",
    inspiration: "",
    selectedTlds: [".com", ".house", ".homes", ".services"],
    customTld: "",
    suggestedTlds: [],
    tldSearch: "",
    tldSuggesting: false,
    tldAutoSuggested: false,
    maxPrice: 50,
    maxLength: 0,
    branchCount: 6,
    branches: [],
    branchState: {},
    phase: "setup",
    globalStatus: "",
    expanded: null,
  };
}

function titleFromPrompt(prompt: string, fallback: string): string {
  const trimmed = prompt.trim();
  if (!trimmed) return fallback;
  return trimmed.length > 36 ? trimmed.slice(0, 33) + "…" : trimmed;
}

function Index() {
  const runFn = useServerFn(runIteration);
  const mapFn = useServerFn(mapBranches);

  const [hunts, setHunts] = useState<Hunt[]>(() => [newHunt(1)]);
  const [activeHuntId, setActiveHuntId] = useState<string>(() => hunts[0]?.id ?? "");
  const [huntSeq, setHuntSeq] = useState(1);

  // Global cart — survives hunt switching/deletion
  const [cart, setCart] = useState<Map<string, CartItem>>(() => new Map());
  const [sidebarTab, setSidebarTab] = useState<"list" | "cart">("list");
  const [copyMsg, setCopyMsg] = useState("");

  const stopRef = useRef(false);
  const huntingRef = useRef(false);

  const activeHunt = hunts.find((h) => h.id === activeHuntId) ?? hunts[0];

  function updateHunt(id: string, patch: Partial<Hunt> | ((h: Hunt) => Partial<Hunt>)) {
    setHunts((curr) =>
      curr.map((h) => {
        if (h.id !== id) return h;
        const p = typeof patch === "function" ? patch(h) : patch;
        return { ...h, ...p };
      })
    );
  }
  function patchActive(patch: Partial<Hunt> | ((h: Hunt) => Partial<Hunt>)) {
    if (!activeHunt) return;
    updateHunt(activeHunt.id, patch);
  }

  function addHunt() {
    const next = huntSeq + 1;
    const h = newHunt(next);
    setHuntSeq(next);
    setHunts((curr) => [...curr, h]);
    setActiveHuntId(h.id);
  }

  function closeHunt(id: string) {
    setHunts((curr) => {
      const idx = curr.findIndex((h) => h.id === id);
      if (idx === -1) return curr;
      const next = curr.filter((h) => h.id !== id);
      if (next.length === 0) {
        const seed = newHunt(huntSeq + 1);
        setHuntSeq((s) => s + 1);
        setActiveHuntId(seed.id);
        return [seed];
      }
      if (id === activeHuntId) {
        setActiveHuntId(next[Math.max(0, idx - 1)].id);
      }
      return next;
    });
  }

  function renameHunt(id: string) {
    const h = hunts.find((x) => x.id === id);
    if (!h) return;
    const name = window.prompt("Rename hunt", h.title)?.trim();
    if (name) updateHunt(id, { title: name });
  }

  // ===== Cart helpers (global) =====
  function inCart(domain: string) {
    return cart.has(domain);
  }
  function addToCart(item: CartItem) {
    setCart((curr) => {
      const next = new Map(curr);
      next.set(item.domain, item);
      return next;
    });
  }
  function removeFromCart(domain: string) {
    setCart((curr) => {
      const next = new Map(curr);
      next.delete(domain);
      return next;
    });
  }
  function toggleCart(item: CartItem) {
    if (cart.has(item.domain)) removeFromCart(item.domain);
    else addToCart(item);
  }
  function bulkSetCart(items: CartItem[], on: boolean) {
    setCart((curr) => {
      const next = new Map(curr);
      items.forEach((it) => (on ? next.set(it.domain, it) : next.delete(it.domain)));
      return next;
    });
  }
  function clearCart() {
    setCart(new Map());
  }
  async function copyCart() {
    if (cart.size === 0) return;
    const list = Array.from(cart.keys()).join("\n");
    try {
      await navigator.clipboard.writeText(list);
      setCopyMsg(`Copied ${cart.size} domain${cart.size === 1 ? "" : "s"} ✓`);
      setTimeout(() => setCopyMsg(""), 2500);
    } catch {
      setCopyMsg("Copy failed");
      setTimeout(() => setCopyMsg(""), 2500);
    }
  }

  // Helper to build a CartItem from a Row in a given hunt+branch
  function makeCartItem(huntId: string, branchId: string, r: Row): CartItem | null {
    const h = hunts.find((x) => x.id === huntId);
    if (!h) return null;
    const b = h.branches.find((x) => x.id === branchId);
    if (!b) return null;
    return {
      domain: r.domain,
      price: r.price,
      huntId,
      huntTitle: h.title,
      branchId,
      branchName: b.name,
    };
  }

  // ===== TLD / setup mutators (scoped to activeHunt) =====
  function toggleTld(tld: string) {
    patchActive((h) => ({
      selectedTlds: h.selectedTlds.includes(tld)
        ? h.selectedTlds.filter((t) => t !== tld)
        : [...h.selectedTlds, tld],
    }));
  }
  function addCustomTld() {
    if (!activeHunt) return;
    let t = activeHunt.customTld.trim().toLowerCase();
    if (!t) return;
    if (!t.startsWith(".")) t = "." + t;
    if (!/^\.[a-z]{2,}$/.test(t)) return;
    patchActive((h) => ({
      selectedTlds: h.selectedTlds.includes(t) ? h.selectedTlds : [...h.selectedTlds, t],
      customTld: "",
    }));
  }

  const suggestFn = useServerFn(suggestTlds);
  async function runSuggestTlds(opts: { auto?: boolean; query?: string } = {}) {
    if (!activeHunt) return;
    const huntId = activeHunt.id;
    const h = activeHunt;
    if (h.tldSuggesting) return;
    if (!h.prompt.trim() && !opts.query?.trim()) return;
    const exclude = Array.from(
      new Set([...TLD_PRESETS, ...h.selectedTlds, ...h.suggestedTlds.map((s) => s.tld)])
    );
    updateHunt(huntId, { tldSuggesting: true });
    try {
      const { tlds } = await suggestFn({
        data: {
          ...(h.prompt.trim() ? { prompt: h.prompt } : {}),
          ...(opts.query?.trim() ? { query: opts.query } : {}),
          exclude,
          count: 10,
        },
      });
      updateHunt(huntId, (curr) => ({
        suggestedTlds: [
          ...curr.suggestedTlds,
          ...tlds.filter((t) => !curr.suggestedTlds.some((s) => s.tld === t.tld)),
        ],
        tldSuggesting: false,
        tldAutoSuggested: opts.auto ? true : curr.tldAutoSuggested,
      }));
    } catch {
      updateHunt(huntId, { tldSuggesting: false });
    }
  }
  function onBriefBlur() {
    if (!activeHunt) return;
    if (activeHunt.tldAutoSuggested) return;
    if (!activeHunt.prompt.trim()) return;
    void runSuggestTlds({ auto: true });
  }

  async function doMapBranches() {
    if (!activeHunt) return;
    if (!activeHunt.prompt.trim() || activeHunt.selectedTlds.length === 0) return;
    const huntId = activeHunt.id;
    updateHunt(huntId, {
      phase: "mapping",
      globalStatus: "DeepSeek is mapping semantic branches…",
      title: titleFromPrompt(activeHunt.prompt, activeHunt.title),
    });
    try {
      const { branches: bs } = await mapFn({
        data: {
          prompt: activeHunt.prompt,
          count: activeHunt.branchCount,
          ...(activeHunt.inspiration.trim() ? { inspiration: activeHunt.inspiration } : {}),
        },
      });
      if (bs.length === 0) {
        updateHunt(huntId, {
          globalStatus: "No branches returned. Try a more descriptive brief.",
          phase: "setup",
        });
        return;
      }
      const init: Record<string, BranchState> = {};
      bs.forEach((b) => {
        init[b.id] = {
          target: 5,
          enabled: true,
          status: "idle",
          tried: [],
          iterations: 0,
          consecutiveZero: 0,
        };
      });
      updateHunt(huntId, {
        branches: bs,
        branchState: init,
        phase: "configure",
        globalStatus: `Mapped ${bs.length} branches. Set targets and start the hunt.`,
      });
    } catch (e) {
      updateHunt(huntId, {
        globalStatus: `Error: ${e instanceof Error ? e.message : "unknown"}`,
        phase: "setup",
      });
    }
  }

  function patchBranch(huntId: string, branchId: string, patch: Partial<BranchState>) {
    setHunts((curr) =>
      curr.map((h) => {
        if (h.id !== huntId) return h;
        return {
          ...h,
          branchState: {
            ...h.branchState,
            [branchId]: { ...h.branchState[branchId], ...patch },
          },
        };
      })
    );
  }

  async function huntBranch(hunt: Hunt, branch: Branch, target: number) {
    let tried: Row[] = [];
    let iterations = 0;
    let consecutiveZero = 0;

    patchBranch(hunt.id, branch.id, {
      status: "running",
      tried: [],
      iterations: 0,
      consecutiveZero: 0,
    });

    while (!stopRef.current) {
      const foundAvailable = tried.filter((r) => r.available === true).length;
      if (foundAvailable >= target) {
        patchBranch(hunt.id, branch.id, { status: "done" });
        return;
      }
      if (consecutiveZero >= GIVE_UP_AFTER_ZERO_HITS || iterations >= MAX_ITERATIONS_PER_BRANCH) {
        patchBranch(hunt.id, branch.id, { status: "exhausted" });
        return;
      }
      iterations++;
      updateHunt(hunt.id, {
        globalStatus: `[${branch.name}] iteration ${iterations} — found ${foundAvailable}/${target}…`,
      });
      try {
        const { results } = await runFn({
          data: {
            prompt: hunt.prompt,
            iteration: iterations,
            history: tried.map((r) => ({ domain: r.domain, available: r.available })),
            tlds: hunt.selectedTlds,
            batchSize: 10,
            branchName: branch.name,
            branchDescription: branch.description,
            branchKeywords: branch.keywords,
            ...(hunt.maxLength ? { maxLength: hunt.maxLength } : {}),
            ...(hunt.inspiration.trim() ? { inspiration: hunt.inspiration } : {}),
          },
        });
        const newRows: Row[] = results.map((r) => ({ ...r, iteration: iterations }));
        tried = [...tried, ...newRows];
        const newAvail = newRows.filter((r) => r.available === true).length;
        consecutiveZero = newAvail === 0 ? consecutiveZero + 1 : 0;
        patchBranch(hunt.id, branch.id, { tried, iterations, consecutiveZero });
      } catch (e) {
        patchBranch(hunt.id, branch.id, {
          status: "error",
          errorMsg: e instanceof Error ? e.message : "unknown",
        });
        return;
      }
    }
    if (stopRef.current) patchBranch(hunt.id, branch.id, { status: "stopped" });
  }

  async function startHunt() {
    if (!activeHunt) return;
    if (huntingRef.current) return;
    huntingRef.current = true;
    stopRef.current = false;
    const huntId = activeHunt.id;
    updateHunt(huntId, { phase: "hunting" });

    // Snapshot of active hunt at start
    const snapshot = hunts.find((h) => h.id === huntId)!;
    const active = snapshot.branches.filter((b) => {
      const s = snapshot.branchState[b.id];
      return s?.enabled && s.target > 0;
    });

    for (const b of active) {
      if (stopRef.current) break;
      // re-read latest state for live target
      const current = hunts.find((h) => h.id === huntId) ?? snapshot;
      const s = current.branchState[b.id];
      await huntBranch(current, b, s.target);
    }

    huntingRef.current = false;
    updateHunt(huntId, {
      phase: "done",
      globalStatus: stopRef.current ? "Hunt stopped." : "Hunt complete.",
    });
  }

  function stopHunt() {
    stopRef.current = true;
    if (activeHunt)
      updateHunt(activeHunt.id, { globalStatus: "Stopping after current iteration…" });
  }

  function resetActive() {
    stopRef.current = true;
    if (!activeHunt) return;
    updateHunt(activeHunt.id, {
      branches: [],
      branchState: {},
      phase: "setup",
      globalStatus: "",
      expanded: null,
    });
  }

  if (!activeHunt) return null;

  const {
    prompt,
    inspiration,
    selectedTlds,
    customTld,
    suggestedTlds,
    tldSearch,
    tldSuggesting,
    maxPrice,
    maxLength,
    branchCount,
    branches,
    branchState,
    phase,
    globalStatus,
    expanded,
  } = activeHunt;

  const meetsFilters = (r: Row) =>
    r.available === true &&
    (r.price == null || r.price <= maxPrice) &&
    (!maxLength || r.domain.length <= maxLength);

  // Derived metrics
  const totalAvailable = branches.reduce(
    (sum, b) => sum + (branchState[b.id]?.tried.filter((r) => r.available === true).length ?? 0),
    0
  );
  const totalChecked = branches.reduce(
    (sum, b) => sum + (branchState[b.id]?.tried.length ?? 0),
    0
  );
  const totalIterations = branches.reduce(
    (sum, b) => sum + (branchState[b.id]?.iterations ?? 0),
    0
  );
  const withinBudgetTotal = branches.reduce(
    (sum, b) => sum + (branchState[b.id]?.tried.filter(meetsFilters).length ?? 0),
    0
  );

  const inDashboard = phase === "configure" || phase === "hunting" || phase === "done";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="flex min-h-screen">
        {/* SIDEBAR NAV */}
        <aside className="hidden w-60 shrink-0 flex-col border-r border-border bg-sidebar md:flex">
          <div className="flex h-16 items-center gap-2 border-b border-border px-5">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground">
              <Globe2 className="h-4 w-4" />
            </div>
            <div className="leading-tight">
              <p className="text-sm font-semibold">Domain Hunter</p>
              <p className="text-[11px] text-muted-foreground">Semantic search</p>
            </div>
          </div>

          <nav className="flex-1 space-y-6 px-3 py-5">
            <div>
              <p className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Workspace
              </p>
              <ul className="space-y-0.5">
                <NavItem icon={Search} label="Hunts" active badge={hunts.length} />
                <NavItem icon={LayoutGrid} label="Branches" muted />
                <NavItem icon={ShoppingCart} label="Cart" badge={cart.size || undefined} />
              </ul>
            </div>
            <div>
              <p className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Insights
              </p>
              <ul className="space-y-0.5">
                <NavItem icon={Activity} label="Activity" muted />
                <NavItem icon={TrendingUp} label="Trends" muted />
                <NavItem icon={Compass} label="Explore" muted />
              </ul>
            </div>
          </nav>

          <div className="border-t border-border p-3">
            <button className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground">
              <Settings className="h-4 w-4" />
              Settings
            </button>
          </div>
        </aside>

        {/* MAIN */}
        <main className="min-w-0 flex-1">
          {/* HUNT TABS */}
          <div className="flex items-center gap-1 border-b border-border bg-card px-3 pt-2">
            <div className="flex flex-1 items-center gap-1 overflow-x-auto">
              {hunts.map((h) => {
                const isActive = h.id === activeHuntId;
                const availCount = h.branches.reduce(
                  (s, b) =>
                    s +
                    (h.branchState[b.id]?.tried.filter((r) => r.available === true).length ?? 0),
                  0
                );
                return (
                  <div
                    key={h.id}
                    className={`group flex shrink-0 items-center gap-2 rounded-t-md border-t border-l border-r px-3 py-1.5 text-[12px] transition ${
                      isActive
                        ? "border-border bg-background font-semibold text-foreground"
                        : "border-transparent text-muted-foreground hover:bg-accent hover:text-foreground"
                    }`}
                  >
                    <button
                      onClick={() => setActiveHuntId(h.id)}
                      onDoubleClick={() => renameHunt(h.id)}
                      className="flex items-center gap-2"
                      title="Double-click to rename"
                    >
                      <span
                        className={`inline-block h-1.5 w-1.5 rounded-full ${
                          h.phase === "hunting"
                            ? "animate-pulse bg-primary"
                            : h.phase === "done"
                              ? "bg-emerald-500"
                              : h.phase === "setup" || h.phase === "mapping"
                                ? "bg-amber-400"
                                : "bg-muted-foreground/40"
                        }`}
                      />
                      <span className="max-w-[180px] truncate">{h.title}</span>
                      {availCount > 0 && (
                        <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                          {availCount}
                        </span>
                      )}
                    </button>
                    <button
                      onClick={() => closeHunt(h.id)}
                      className="text-muted-foreground/60 opacity-0 transition hover:text-foreground group-hover:opacity-100"
                      title="Close hunt"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                );
              })}
              <button
                onClick={addHunt}
                className="ml-1 inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1.5 text-[12px] font-medium text-muted-foreground transition hover:bg-accent hover:text-foreground"
                title="New hunt"
              >
                <Plus className="h-3.5 w-3.5" />
                New hunt
              </button>
            </div>
          </div>

          {/* HEADER BAR */}
          <header className="sticky top-0 z-10 flex h-16 items-center justify-between gap-4 border-b border-border bg-background/80 px-6 backdrop-blur">
            <div className="flex items-center gap-3">
              <h1 className="text-[20px] font-semibold tracking-tight">
                {phase === "setup" || phase === "mapping"
                  ? activeHunt.title
                  : `${activeHunt.title} · overview`}
              </h1>
              {inDashboard && (
                <span className="hidden text-sm text-muted-foreground sm:inline">
                  · {branches.length} branches
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {phase !== "setup" && (
                <button
                  onClick={resetActive}
                  className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground transition hover:bg-accent"
                >
                  Reset hunt
                </button>
              )}
              {inDashboard &&
                (phase !== "hunting" ? (
                  <button
                    onClick={startHunt}
                    disabled={
                      !branches.some(
                        (b) => branchState[b.id]?.enabled && branchState[b.id]?.target > 0
                      )
                    }
                    className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-1.5 text-xs font-medium text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    {phase === "done" ? "Resume hunt" : "Start hunt"}
                  </button>
                ) : (
                  <button
                    onClick={stopHunt}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-destructive px-3.5 py-1.5 text-xs font-medium text-destructive-foreground transition hover:opacity-90"
                  >
                    <Square className="h-3.5 w-3.5" />
                    Stop
                  </button>
                ))}
            </div>
          </header>

          {/* CONTENT */}
          <div
            className={
              inDashboard
                ? "grid gap-6 px-6 py-6 lg:grid-cols-[1fr_340px]"
                : "grid gap-6 px-6 py-6 lg:grid-cols-[1fr_340px]"
            }
          >
            <div className="min-w-0 space-y-6">
              {/* PHASE 1: SETUP */}
              {(phase === "setup" || phase === "mapping") && (
                <section className="rounded-xl border border-border bg-card p-5 shadow-card">
                  <div className="mb-5">
                    <h2 className="text-base font-semibold">Brief</h2>
                    <p className="mt-0.5 text-[13px] text-muted-foreground">
                      Describe what you're naming. We'll map semantic angles and hunt domains
                      across each.
                    </p>
                  </div>
                  <textarea
                    value={prompt}
                    onChange={(e) => patchActive({ prompt: e.target.value })}
                    onBlur={onBriefBlur}
                    disabled={phase === "mapping"}
                    rows={3}
                    placeholder="e.g. A national home-services platform connecting homeowners with vetted local pros."
                    className="w-full resize-none rounded-lg border border-border bg-card px-3.5 py-2.5 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-3 focus:ring-primary/20 disabled:opacity-50"
                  />

                  <div className="mt-4">
                    <label className="mb-1.5 block text-[12px] font-medium text-muted-foreground">
                      Inspiration <span className="text-muted-foreground/70">(optional — keywords or example domains you like, comma-separated)</span>
                    </label>
                    <textarea
                      value={inspiration}
                      onChange={(e) => patchActive({ inspiration: e.target.value })}
                      disabled={phase === "mapping"}
                      rows={2}
                      placeholder="e.g. stripe.com, linear.app, calm, swift, nimble"
                      className="w-full resize-none rounded-lg border border-border bg-card px-3.5 py-2.5 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-3 focus:ring-primary/20 disabled:opacity-50"
                    />
                  </div>

                  <div className="mt-6">
                    <div className="mb-3 flex items-center justify-between">
                      <h3 className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">
                        TLDs · {selectedTlds.length} selected
                      </h3>
                      {selectedTlds.length > 0 && (
                        <button
                          onClick={() => patchActive({ selectedTlds: [] })}
                          disabled={phase === "mapping"}
                          className="text-xs font-medium text-muted-foreground hover:text-foreground disabled:opacity-40"
                        >
                          Clear all
                        </button>
                      )}
                    </div>
                    <div className="space-y-4">
                      {TLD_GROUPS.map((group) => {
                        const items = TLD_CATALOG.filter((t) => t.group === group);
                        const allOn = items.every((i) => selectedTlds.includes(i.tld));
                        return (
                          <div key={group}>
                            <div className="mb-1.5 flex items-center gap-2">
                              <span className="text-[11px] font-semibold uppercase tracking-wider text-foreground/70">
                                {group}
                              </span>
                              <button
                                onClick={() => {
                                  if (allOn) {
                                    patchActive({
                                      selectedTlds: selectedTlds.filter(
                                        (t) => !items.some((i) => i.tld === t)
                                      ),
                                    });
                                  } else {
                                    const add = items
                                      .map((i) => i.tld)
                                      .filter((t) => !selectedTlds.includes(t));
                                    patchActive({ selectedTlds: [...selectedTlds, ...add] });
                                  }
                                }}
                                disabled={phase === "mapping"}
                                className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground hover:text-primary disabled:opacity-40"
                              >
                                {allOn ? "deselect all" : "select all"}
                              </button>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {items.map(({ tld, avg }) => {
                                const on = selectedTlds.includes(tld);
                                const bucket = priceBucket(avg);
                                return (
                                  <button
                                    key={tld}
                                    onClick={() => toggleTld(tld)}
                                    disabled={phase === "mapping"}
                                    title={`Avg ~$${avg}/yr`}
                                    className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-xs transition disabled:opacity-50 ${
                                      on
                                        ? "border-primary bg-primary/10 text-primary"
                                        : "border-border bg-card text-foreground/80 hover:border-foreground/30"
                                    }`}
                                  >
                                    <span>{tld}</span>
                                    <span
                                      className={`text-[10px] font-medium ${
                                        on ? "text-primary/70" : bucket.tone
                                      }`}
                                    >
                                      {bucket.label}
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}

                      {suggestedTlds.length > 0 && (
                        <div>
                          <div className="mb-1.5 flex items-center gap-2">
                            <Sparkles className="h-3 w-3 text-primary" />
                            <span className="text-[11px] font-semibold uppercase tracking-wider text-primary">
                              AI suggested for your brief
                            </span>
                            <button
                              onClick={() => patchActive({ suggestedTlds: [] })}
                              disabled={phase === "mapping"}
                              className="ml-auto text-[10px] font-medium uppercase tracking-wider text-muted-foreground hover:text-foreground disabled:opacity-40"
                            >
                              clear
                            </button>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {suggestedTlds.map(({ tld, avg, reason }) => {
                              const on = selectedTlds.includes(tld);
                              const bucket = priceBucket(avg);
                              return (
                                <button
                                  key={tld}
                                  onClick={() => toggleTld(tld)}
                                  disabled={phase === "mapping"}
                                  title={reason ? `${reason} · ~$${avg}/yr` : `Avg ~$${avg}/yr`}
                                  className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-xs transition disabled:opacity-50 ${
                                    on
                                      ? "border-primary bg-primary/10 text-primary"
                                      : "border-primary/40 bg-primary/5 text-foreground/80 hover:border-primary"
                                  }`}
                                >
                                  <span>{tld}</span>
                                  <span
                                    className={`text-[10px] font-medium ${
                                      on ? "text-primary/70" : bucket.tone
                                    }`}
                                  >
                                    {bucket.label}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      <div>
                        <div className="mb-1.5 flex items-center gap-2">
                          <span className="text-[11px] font-semibold uppercase tracking-wider text-foreground/70">
                            Find more TLDs
                          </span>
                          {tldSuggesting && (
                            <span className="text-[10px] text-muted-foreground">searching…</span>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <input
                            value={tldSearch}
                            onChange={(e) => patchActive({ tldSearch: e.target.value })}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                void runSuggestTlds({ query: tldSearch });
                              }
                            }}
                            disabled={phase === "mapping" || tldSuggesting}
                            placeholder="describe TLDs you want (e.g. food, finance, country)"
                            className="min-w-[240px] flex-1 rounded-full border border-border bg-card px-3 py-1 text-xs placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                          />
                          <button
                            onClick={() => void runSuggestTlds({ query: tldSearch })}
                            disabled={
                              phase === "mapping" ||
                              tldSuggesting ||
                              (!tldSearch.trim() && !prompt.trim())
                            }
                            className="inline-flex items-center gap-1 rounded-full border border-primary bg-primary/10 px-3 py-1 text-xs font-medium text-primary hover:bg-primary/20 disabled:opacity-40"
                          >
                            <Sparkles className="h-3 w-3" />
                            AI suggest
                          </button>
                        </div>
                      </div>
                    </div>
                    <div className="mt-4 flex flex-wrap items-center gap-1.5">
                      {selectedTlds
                        .filter((t) => !TLD_PRESETS.includes(t) && !suggestedTlds.some((s) => s.tld === t))
                        .map((tld) => (
                            <button
                              key={tld}
                              onClick={() => toggleTld(tld)}
                              className="inline-flex items-center gap-1 rounded-full border border-primary bg-primary/10 px-2.5 py-1 font-mono text-xs text-primary"
                            >
                              {tld}
                              <X className="h-3 w-3" />
                            </button>
                          ))}
                        <div className="flex items-center gap-1">
                          <input
                            value={customTld}
                            onChange={(e) => patchActive({ customTld: e.target.value })}
                            onKeyDown={(e) =>
                              e.key === "Enter" && (e.preventDefault(), addCustomTld())
                            }
                            disabled={phase === "mapping"}
                            placeholder=".custom"
                            className="w-24 rounded-full border border-border bg-card px-3 py-1 font-mono text-xs placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                          />
                          <button
                            onClick={addCustomTld}
                            disabled={phase === "mapping" || !customTld.trim()}
                            className="text-xs font-medium text-muted-foreground hover:text-primary disabled:opacity-40"
                          >
                            + add
                          </button>
                        </div>
                      </div>
                    </div>


                  <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <div>
                      <label className="mb-1.5 block text-[12px] font-medium text-muted-foreground">
                        Branches to map:{" "}
                        <span className="font-semibold text-foreground">{branchCount}</span>
                      </label>
                      <input
                        type="range"
                        min={3}
                        max={10}
                        value={branchCount}
                        onChange={(e) => patchActive({ branchCount: Number(e.target.value) })}
                        disabled={phase === "mapping"}
                        className="w-full accent-primary"
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-[12px] font-medium text-muted-foreground">
                        Max $/yr budget
                      </label>
                      <input
                        type="number"
                        min={0}
                        value={maxPrice}
                        onChange={(e) => patchActive({ maxPrice: Number(e.target.value) || 0 })}
                        disabled={phase === "mapping"}
                        className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-3 focus:ring-primary/20 disabled:opacity-50"
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-[12px] font-medium text-muted-foreground">
                        Max chars{" "}
                        <span className="text-muted-foreground/70">(name + TLD, 0 = no limit)</span>
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={40}
                        value={maxLength}
                        onChange={(e) =>
                          patchActive({ maxLength: Math.max(0, Number(e.target.value) || 0) })
                        }
                        disabled={phase === "mapping"}
                        placeholder="e.g. 14"
                        className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-3 focus:ring-primary/20 disabled:opacity-50"
                      />
                    </div>
                    <div className="flex items-end">
                      <button
                        onClick={doMapBranches}
                        disabled={
                          phase === "mapping" || !prompt.trim() || selectedTlds.length === 0
                        }
                        className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <Sparkles className="h-4 w-4" />
                        {phase === "mapping" ? "Mapping…" : "Map semantic branches"}
                      </button>
                    </div>
                  </div>

                  {globalStatus && (
                    <p className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
                      {phase === "mapping" && (
                        <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
                      )}
                      {globalStatus}
                    </p>
                  )}
                </section>
              )}

              {/* PHASE 2/3: METRIC CARDS + BRANCHES */}
              {inDashboard && (
                <>
                  <section className="rounded-xl border border-border bg-card p-4 shadow-card">
                    <div className="flex items-start gap-3">
                      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                        <Compass className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                          Brief
                        </p>
                        <p className="mt-0.5 truncate text-sm text-foreground" title={prompt}>
                          {prompt}
                        </p>
                        <p className="mt-1 text-[12px] text-muted-foreground">
                          {selectedTlds.length} TLDs · budget ≤ ${maxPrice}/yr
                          {maxLength ? ` · ≤ ${maxLength} chars` : ""} · {branches.length}{" "}
                          semantic branches
                        </p>
                      </div>
                    </div>
                    {globalStatus && (
                      <p className="mt-3 flex items-center gap-2 border-t border-border pt-3 text-xs text-muted-foreground">
                        {phase === "hunting" && (
                          <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
                        )}
                        {globalStatus}
                      </p>
                    )}
                  </section>

                  <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                    <MetricCard
                      label="Available found"
                      value={totalAvailable}
                      icon={Check}
                      tone="primary"
                    />
                    <MetricCard
                      label="Within filters"
                      value={withinBudgetTotal}
                      icon={Target}
                      hint={`≤ $${maxPrice}/yr${maxLength ? ` · ≤ ${maxLength} chars` : ""}`}
                    />
                    <MetricCard label="Domains checked" value={totalChecked} icon={Search} />
                    <MetricCard label="Iterations" value={totalIterations} icon={Activity} />
                  </section>

                  <section>
                    <div className="mb-3 flex items-center justify-between">
                      <h2 className="text-base font-semibold">Semantic branches</h2>
                      <p className="text-[12px] text-muted-foreground">
                        Click a branch for full details
                      </p>
                    </div>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      {branches.map((b) => {
                        const s = branchState[b.id];
                        if (!s) return null;
                        return (
                          <BranchCard
                            key={b.id}
                            branch={b}
                            state={s}
                            maxPrice={maxPrice}
                            maxLength={maxLength}
                            locked={phase === "hunting"}
                            cart={cart}
                            onToggleCart={(row) => {
                              const item = makeCartItem(activeHunt.id, b.id, row);
                              if (item) toggleCart(item);
                            }}
                            onChangeTarget={(target) =>
                              patchBranch(activeHunt.id, b.id, { target })
                            }
                            onToggleEnabled={(enabled) =>
                              patchBranch(activeHunt.id, b.id, { enabled })
                            }
                            onOpen={() => patchActive({ expanded: b.id })}
                          />
                        );
                      })}
                    </div>
                  </section>
                </>
              )}
            </div>

            <RightPanel
              tab={sidebarTab}
              setTab={setSidebarTab}
              hunts={hunts}
              cart={cart}
              maxPrice={maxPrice}
              maxLength={maxLength}
              onToggleCart={(huntId, branchId, row) => {
                const item = makeCartItem(huntId, branchId, row);
                if (item) toggleCart(item);
              }}
              onBulkSetCart={bulkSetCart}
              onRemoveFromCart={removeFromCart}
              onClearCart={clearCart}
              onCopyCart={copyCart}
              copyMsg={copyMsg}
              activeHuntId={activeHunt.id}
            />
          </div>
        </main>
      </div>

      {expanded && (
        <BranchDetail
          branch={branches.find((b) => b.id === expanded)!}
          state={branchState[expanded]}
          maxPrice={maxPrice}
          maxLength={maxLength}
          cart={cart}
          onToggleCart={(row) => {
            const item = makeCartItem(activeHunt.id, expanded, row);
            if (item) toggleCart(item);
          }}
          onClose={() => patchActive({ expanded: null })}
        />
      )}
    </div>
  );
}

function NavItem({
  icon: Icon,
  label,
  active,
  muted,
  badge,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  active?: boolean;
  muted?: boolean;
  badge?: number;
}) {
  return (
    <li>
      <button
        className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] transition ${
          active
            ? "bg-card font-semibold text-foreground shadow-card"
            : muted
              ? "text-muted-foreground hover:bg-accent hover:text-foreground"
              : "text-foreground hover:bg-accent"
        }`}
      >
        <Icon className="h-4 w-4 shrink-0" />
        <span className="flex-1 text-left">{label}</span>
        {badge != null && badge > 0 && (
          <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground">
            {badge}
          </span>
        )}
      </button>
    </li>
  );
}

function MetricCard({
  label,
  value,
  icon: Icon,
  hint,
  tone,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  hint?: string;
  tone?: "primary";
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-card transition hover:shadow-card-hover">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[12px] font-medium text-muted-foreground">{label}</p>
          <p className="mt-2 text-[28px] font-semibold leading-none tracking-tight tabular-nums">
            {value}
          </p>
          {hint && <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>}
        </div>
        <div
          className={`grid h-8 w-8 place-items-center rounded-lg ${
            tone === "primary" ? "bg-primary/10 text-primary" : "bg-accent text-foreground/60"
          }`}
        >
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </div>
  );
}

function statusBadge(status: BranchState["status"]) {
  const map: Record<BranchState["status"], { label: string; cls: string }> = {
    idle: { label: "Idle", cls: "bg-accent text-muted-foreground" },
    running: { label: "Hunting", cls: "bg-primary/10 text-primary" },
    done: { label: "Target hit", cls: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200" },
    exhausted: { label: "Exhausted", cls: "bg-amber-50 text-amber-700 ring-1 ring-amber-200" },
    stopped: { label: "Stopped", cls: "bg-accent text-foreground/60" },
    error: { label: "Error", cls: "bg-red-50 text-red-700 ring-1 ring-red-200" },
  };
  const m = map[status];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${m.cls}`}
    >
      {status === "running" && (
        <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
      )}
      {m.label}
    </span>
  );
}

function BranchCard({
  branch,
  state,
  maxPrice,
  maxLength,
  locked,
  cart,
  onToggleCart,
  onChangeTarget,
  onToggleEnabled,
  onOpen,
}: {
  branch: Branch;
  state: BranchState;
  maxPrice: number;
  maxLength: number;
  locked: boolean;
  cart: Map<string, CartItem>;
  onToggleCart: (r: Row) => void;
  onChangeTarget: (n: number) => void;
  onToggleEnabled: (b: boolean) => void;
  onOpen: () => void;
}) {
  const [showAll, setShowAll] = useState(false);
  const availableSorted = useMemo(
    () =>
      state.tried
        .filter((r) => r.available === true)
        .sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity)),
    [state.tried]
  );
  const visible = showAll ? availableSorted : availableSorted.slice(0, 5);
  const found = availableSorted.length;
  const withinBudget = state.tried.filter(
    (r) =>
      r.available === true &&
      (r.price == null || r.price <= maxPrice) &&
      (!maxLength || r.domain.length <= maxLength)
  ).length;
  const pct = state.target > 0 ? Math.min(100, (found / state.target) * 100) : 0;

  return (
    <div
      className={`rounded-xl border bg-card p-5 shadow-card transition hover:shadow-card-hover ${
        state.enabled ? "border-border" : "border-border opacity-60"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-[15px] font-semibold">{branch.name}</h3>
            {statusBadge(state.status)}
          </div>
          <p className="mt-1 line-clamp-2 text-[13px] text-muted-foreground">
            {branch.description}
          </p>
          <div className="mt-2.5 flex flex-wrap gap-1">
            {branch.keywords.slice(0, 6).map((k) => (
              <span
                key={k}
                className="rounded-md bg-accent px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground"
              >
                {k}
              </span>
            ))}
          </div>
        </div>
        <label className="flex shrink-0 cursor-pointer items-center gap-1.5 text-[11px] text-muted-foreground">
          <input
            type="checkbox"
            checked={state.enabled}
            disabled={locked}
            onChange={(e) => onToggleEnabled(e.target.checked)}
            className="accent-primary"
          />
          On
        </label>
      </div>

      <div className="mt-4 flex items-center gap-3 rounded-lg border border-border bg-background p-3">
        <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Target
        </label>
        <input
          type="number"
          min={0}
          max={50}
          value={state.target}
          disabled={locked || !state.enabled}
          onChange={(e) => onChangeTarget(Math.max(0, Number(e.target.value) || 0))}
          className="w-14 rounded-md border border-border bg-card px-2 py-1 text-xs focus:border-primary focus:outline-none focus:ring-3 focus:ring-primary/20 disabled:opacity-50"
        />
        <div className="flex-1">
          <div className="h-1.5 overflow-hidden rounded-full bg-accent">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
        <span className="font-mono text-xs text-foreground tabular-nums">
          {found}
          <span className="text-muted-foreground">/{state.target}</span>
        </span>
      </div>

      <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground">
        <span>
          {state.tried.length} checked · iter {state.iterations} · {withinBudget} within ${maxPrice}
        </span>
        <button
          onClick={onOpen}
          className="inline-flex items-center gap-0.5 rounded-md border border-border bg-card px-2 py-1 font-medium text-foreground/70 transition hover:bg-accent hover:text-foreground"
        >
          Details
          <ChevronRight className="h-3 w-3" />
        </button>
      </div>

      {availableSorted.length > 0 && (
        <div className="mt-4 rounded-lg border border-border bg-background p-2.5">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-foreground/70">
              Available · {availableSorted.length}
            </p>
            <span className="text-[10px] text-muted-foreground">sorted by price</span>
          </div>
          <ul className="divide-y divide-border">
            {visible.map((r) => {
              const isSel = cart.has(r.domain);
              const overBudget = r.price != null && r.price > maxPrice;
              const overLength = maxLength > 0 && r.domain.length > maxLength;
              return (
                <li key={r.domain} className="flex items-center gap-2 py-1.5">
                  <input
                    type="checkbox"
                    checked={isSel}
                    onChange={() => onToggleCart(r)}
                    className="accent-primary"
                    title={isSel ? "Remove from cart" : "Add to cart"}
                  />
                  <span className="flex-1 truncate font-mono text-[12px] text-foreground">
                    {r.domain}
                  </span>
                  <span
                    className={`font-mono text-[10px] tabular-nums ${
                      overLength ? "text-amber-600" : "text-muted-foreground/70"
                    }`}
                    title={maxLength > 0 ? `Max ${maxLength} chars` : "Character count"}
                  >
                    {r.domain.length}c
                  </span>
                  {r.price != null && (
                    <span
                      className={`font-mono text-[11px] tabular-nums ${
                        overBudget ? "text-amber-600" : "text-muted-foreground"
                      }`}
                    >
                      ${r.price.toFixed(0)}/yr
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
          {availableSorted.length > 5 && (
            <button
              onClick={() => setShowAll((v) => !v)}
              className="mt-1.5 w-full rounded-md py-1 text-center text-[11px] font-medium text-primary hover:bg-primary/5"
            >
              {showAll ? "Show less" : `Show ${availableSorted.length - 5} more`}
            </button>
          )}
        </div>
      )}

      {state.errorMsg && (
        <p className="mt-3 rounded-md bg-red-50 px-2 py-1.5 text-[11px] text-red-700 ring-1 ring-red-200">
          {state.errorMsg}
        </p>
      )}
    </div>
  );
}

function BranchDetail({
  branch,
  state,
  maxPrice,
  maxLength,
  cart,
  onToggleCart,
  onClose,
}: {
  branch: Branch;
  state: BranchState;
  maxPrice: number;
  maxLength: number;
  cart: Map<string, CartItem>;
  onToggleCart: (r: Row) => void;
  onClose: () => void;
}) {
  const [tldFilter, setTldFilter] = useState("all");
  const [budgetOnly, setBudgetOnly] = useState(false);
  const [lengthOnly, setLengthOnly] = useState(false);

  const resultTlds = useMemo(() => {
    const set = new Set<string>();
    state.tried.forEach((r) => {
      const m = r.domain.match(/\.[a-z]+$/);
      if (m) set.add(m[0]);
    });
    return Array.from(set).sort();
  }, [state.tried]);

  const filtered = state.tried.filter((r) => {
    if (tldFilter !== "all" && !r.domain.endsWith(tldFilter)) return false;
    if (budgetOnly && (r.price == null || r.price > maxPrice)) return false;
    if (lengthOnly && maxLength && r.domain.length > maxLength) return false;
    return true;
  });

  const available = filtered
    .filter((r) => r.available === true)
    .sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity));
  const taken = filtered.filter((r) => r.available === false);
  const errors = filtered.filter((r) => r.available === null);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="max-h-[85vh] w-full max-w-3xl overflow-hidden rounded-xl border border-border bg-card shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-3 border-b border-border p-5">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold">{branch.name}</h2>
              {statusBadge(state.status)}
            </div>
            <p className="mt-1 text-[13px] text-muted-foreground">{branch.description}</p>
            <p className="mt-1 text-[12px] text-muted-foreground">
              {available.length} available · {taken.length} taken · {errors.length} errors · iter{" "}
              {state.iterations}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg border border-border bg-card p-1.5 text-muted-foreground transition hover:bg-accent hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="flex flex-wrap items-center gap-2 border-b border-border bg-background px-5 py-3">
          <button
            onClick={() => setTldFilter("all")}
            className={`rounded-full border px-2.5 py-0.5 font-mono text-[11px] transition ${
              tldFilter === "all"
                ? "border-primary bg-primary/10 text-primary"
                : "border-border bg-card text-muted-foreground hover:border-foreground/30"
            }`}
          >
            all
          </button>
          {resultTlds.map((t) => (
            <button
              key={t}
              onClick={() => setTldFilter(t)}
              className={`rounded-full border px-2.5 py-0.5 font-mono text-[11px] transition ${
                tldFilter === t
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-card text-muted-foreground hover:border-foreground/30"
              }`}
            >
              {t}
            </button>
          ))}
          <label className="ml-auto flex cursor-pointer items-center gap-1.5 text-[12px] text-muted-foreground">
            <input
              type="checkbox"
              checked={budgetOnly}
              onChange={(e) => setBudgetOnly(e.target.checked)}
              className="accent-primary"
            />
            ≤ ${maxPrice}/yr
          </label>
          {maxLength > 0 && (
            <label className="flex cursor-pointer items-center gap-1.5 text-[12px] text-muted-foreground">
              <input
                type="checkbox"
                checked={lengthOnly}
                onChange={(e) => setLengthOnly(e.target.checked)}
                className="accent-primary"
              />
              ≤ {maxLength} chars
            </label>
          )}
        </div>

        <div className="max-h-[60vh] overflow-y-auto bg-background p-5">
          <Section title={`Available (${available.length})`} tone="primary">
            {available.length === 0 ? (
              <p className="text-[13px] text-muted-foreground">None yet.</p>
            ) : (
              <ul className="divide-y divide-border rounded-lg border border-border bg-card">
                {available.map((r, i) => {
                  const overLength = maxLength > 0 && r.domain.length > maxLength;
                  return (
                  <li key={i} className="flex items-center gap-3 px-3 py-2 text-sm">
                    <input
                      type="checkbox"
                      checked={cart.has(r.domain)}
                      onChange={() => onToggleCart(r)}
                      className="accent-primary"
                    />
                    <span className="flex-1 font-mono text-foreground">{r.domain}</span>
                    <span className="flex items-center gap-3 text-xs">
                      <span
                        className={`font-mono tabular-nums ${
                          overLength ? "text-amber-600" : "text-muted-foreground/70"
                        }`}
                        title={maxLength > 0 ? `Max ${maxLength} chars` : "Character count"}
                      >
                        {r.domain.length}c
                      </span>
                      {r.price != null && (
                        <span
                          className={`font-mono tabular-nums ${
                            r.price > maxPrice ? "text-amber-600" : "text-muted-foreground"
                          }`}
                        >
                          ${r.price.toFixed(2)}/yr
                        </span>
                      )}
                      <span className="text-muted-foreground/60">#{r.iteration}</span>
                    </span>
                  </li>
                  );
                })}
              </ul>
            )}
          </Section>

          <Section title={`Tried & taken (${taken.length})`} tone="muted">
            {taken.length === 0 ? (
              <p className="text-[13px] text-muted-foreground">None.</p>
            ) : (
              <ul className="flex flex-wrap gap-1.5">
                {taken.map((r, i) => (
                  <li
                    key={i}
                    className="rounded-md bg-card px-2 py-1 font-mono text-xs text-muted-foreground line-through ring-1 ring-border"
                    title={`iter #${r.iteration}`}
                  >
                    {r.domain}
                  </li>
                ))}
              </ul>
            )}
          </Section>

          {errors.length > 0 && (
            <Section title={`Errors (${errors.length})`} tone="amber">
              <ul className="space-y-1">
                {errors.map((r, i) => (
                  <li key={i} className="font-mono text-xs text-amber-700">
                    {r.domain}{" "}
                    <span className="text-muted-foreground">— {r.error ?? "unknown"}</span>
                  </li>
                ))}
              </ul>
            </Section>
          )}
        </div>
      </div>
    </div>
  );
}

function Section({
  title,
  tone,
  children,
}: {
  title: string;
  tone: "primary" | "muted" | "amber";
  children: React.ReactNode;
}) {
  const toneCls = {
    primary: "text-primary",
    muted: "text-muted-foreground",
    amber: "text-amber-700",
  }[tone];
  return (
    <div className="mb-5">
      <h3 className={`mb-2 text-[11px] font-semibold uppercase tracking-wider ${toneCls}`}>
        {title}
      </h3>
      {children}
    </div>
  );
}

// ============= RIGHT PANEL: List + Cart =============
function RightPanel({
  tab,
  setTab,
  hunts,
  cart,
  maxPrice,
  maxLength,
  onToggleCart,
  onBulkSetCart,
  onRemoveFromCart,
  onClearCart,
  onCopyCart,
  copyMsg,
  activeHuntId,
}: {
  tab: "list" | "cart";
  setTab: (t: "list" | "cart") => void;
  hunts: Hunt[];
  cart: Map<string, CartItem>;
  maxPrice: number;
  maxLength: number;
  onToggleCart: (huntId: string, branchId: string, r: Row) => void;
  onBulkSetCart: (items: CartItem[], on: boolean) => void;
  onRemoveFromCart: (domain: string) => void;
  onClearCart: () => void;
  onCopyCart: () => Promise<void>;
  copyMsg: string;
  activeHuntId: string;
}) {
  // Build the "list" — all available domains across all hunts that match the active hunt's budget
  type ListBranchGroup = {
    huntId: string;
    huntTitle: string;
    branchId: string;
    branchName: string;
    rows: Row[];
  };
  type ListHuntGroup = {
    huntId: string;
    huntTitle: string;
    isActive: boolean;
    branches: ListBranchGroup[];
  };

  const listGroups: ListHuntGroup[] = hunts
    .map((h) => {
      const branches = h.branches
        .map((b) => {
          const rows = (h.branchState[b.id]?.tried ?? [])
            .filter((r) => r.available === true)
            .filter((r) => r.price == null || r.price <= maxPrice)
            .sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity));
          return {
            huntId: h.id,
            huntTitle: h.title,
            branchId: b.id,
            branchName: b.name,
            rows,
          };
        })
        .filter((g) => g.rows.length > 0);
      return {
        huntId: h.id,
        huntTitle: h.title,
        isActive: h.id === activeHuntId,
        branches,
      };
    })
    .filter((g) => g.branches.length > 0);

  const totalList = listGroups.reduce(
    (s, hg) => s + hg.branches.reduce((s2, bg) => s2 + bg.rows.length, 0),
    0
  );

  // Cart grouped by hunt -> branch
  const cartByHuntBranch = useMemo(() => {
    const map = new Map<string, Map<string, CartItem[]>>();
    Array.from(cart.values()).forEach((item) => {
      if (!map.has(item.huntId)) map.set(item.huntId, new Map());
      const branches = map.get(item.huntId)!;
      if (!branches.has(item.branchId)) branches.set(item.branchId, []);
      branches.get(item.branchId)!.push(item);
    });
    // sort items by price
    map.forEach((branches) => {
      branches.forEach((arr) =>
        arr.sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity))
      );
    });
    return map;
  }, [cart]);

  return (
    <aside className="lg:sticky lg:top-22 lg:self-start">
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-card">
        {/* Tab header */}
        <div className="flex border-b border-border">
          <button
            onClick={() => setTab("list")}
            className={`flex flex-1 items-center justify-center gap-1.5 px-3 py-2.5 text-[12px] font-medium transition ${
              tab === "list"
                ? "border-b-2 border-primary text-foreground"
                : "border-b-2 border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <ListChecks className="h-3.5 w-3.5" />
            List
            <span
              className={`rounded-full px-1.5 py-0.5 text-[10px] ${
                tab === "list" ? "bg-primary/10 text-primary" : "bg-accent text-muted-foreground"
              }`}
            >
              {totalList}
            </span>
          </button>
          <button
            onClick={() => setTab("cart")}
            className={`flex flex-1 items-center justify-center gap-1.5 px-3 py-2.5 text-[12px] font-medium transition ${
              tab === "cart"
                ? "border-b-2 border-primary text-foreground"
                : "border-b-2 border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <ShoppingCart className="h-3.5 w-3.5" />
            Cart
            <span
              className={`rounded-full px-1.5 py-0.5 text-[10px] ${
                tab === "cart" ? "bg-primary/10 text-primary" : "bg-accent text-muted-foreground"
              }`}
            >
              {cart.size}
            </span>
          </button>
        </div>

        {/* Body */}
        {tab === "list" ? (
          <div className="max-h-[78vh] overflow-y-auto p-3">
            <p className="mb-2 px-1 text-[11px] text-muted-foreground">
              Candidates ≤ ${maxPrice}/yr, grouped by hunt → branch. Tick to add to cart.
              {maxLength > 0 && " Over " + maxLength + " chars shown in amber."}
            </p>
            {totalList === 0 ? (
              <EmptyState
                icon={ListChecks}
                text="No candidates yet. Hits will appear here as the hunt runs."
              />
            ) : (
              <ul className="space-y-4">
                {listGroups.map((hg) => (
                  <li key={hg.huntId}>
                    <div className="mb-1.5 flex items-center gap-1.5 px-1">
                      <span
                        className={`truncate text-[11px] font-semibold uppercase tracking-wider ${
                          hg.isActive ? "text-primary" : "text-foreground/70"
                        }`}
                      >
                        {hg.huntTitle}
                      </span>
                      {hg.isActive && (
                        <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[9px] font-medium uppercase text-primary">
                          active
                        </span>
                      )}
                    </div>
                    <ul className="space-y-3">
                      {hg.branches.map((bg) => {
                        const items: CartItem[] = bg.rows.map((r) => ({
                          domain: r.domain,
                          price: r.price,
                          huntId: bg.huntId,
                          huntTitle: bg.huntTitle,
                          branchId: bg.branchId,
                          branchName: bg.branchName,
                        }));
                        const allSel = items.every((it) => cart.has(it.domain));
                        return (
                          <li key={bg.branchId}>
                            <div className="mb-1 flex items-center justify-between gap-2 px-1">
                              <span className="truncate text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                                {bg.branchName}
                              </span>
                              <button
                                onClick={() => onBulkSetCart(items, !allSel)}
                                className="shrink-0 text-[10px] font-medium uppercase tracking-wider text-muted-foreground hover:text-primary"
                              >
                                {allSel ? "none" : "all"}
                              </button>
                            </div>
                            <ul className="space-y-0.5">
                              {bg.rows.map((r) => {
                                const isSel = cart.has(r.domain);
                                const overLength = maxLength > 0 && r.domain.length > maxLength;
                                return (
                                  <li
                                    key={r.domain}
                                    className={`flex items-center gap-2 rounded-md px-2 py-1.5 transition ${
                                      isSel ? "bg-primary/5" : "hover:bg-accent"
                                    }`}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={isSel}
                                      onChange={() => onToggleCart(bg.huntId, bg.branchId, r)}
                                      className="accent-primary"
                                    />
                                    <span className="flex-1 truncate font-mono text-[12px] text-foreground">
                                      {r.domain}
                                    </span>
                                    <span
                                      className={`font-mono text-[10px] tabular-nums ${
                                        overLength ? "text-amber-600" : "text-muted-foreground/70"
                                      }`}
                                      title={maxLength > 0 ? `Max ${maxLength} chars` : "Character count"}
                                    >
                                      {r.domain.length}c
                                    </span>
                                    {r.price != null && (
                                      <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
                                        ${r.price.toFixed(0)}
                                      </span>
                                    )}
                                  </li>
                                );
                              })}
                            </ul>
                          </li>
                        );
                      })}
                    </ul>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : (
          <div className="flex flex-col">
            <div className="border-b border-border p-3">
              <div className="flex items-center justify-between">
                <p className="text-[11px] text-muted-foreground">
                  <span className="font-semibold text-foreground">{cart.size}</span> domain
                  {cart.size === 1 ? "" : "s"} to buy
                </p>
                {cart.size > 0 && (
                  <button
                    onClick={onClearCart}
                    className="text-[11px] font-medium text-muted-foreground hover:text-foreground"
                  >
                    Clear
                  </button>
                )}
              </div>
              <button
                onClick={onCopyCart}
                disabled={cart.size === 0}
                className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ClipboardCopy className="h-3.5 w-3.5" />
                Copy {cart.size > 0 ? `${cart.size} ` : ""}to clipboard
              </button>
              {copyMsg && (
                <p className="mt-1.5 flex items-center gap-1 text-[11px] font-medium text-primary">
                  <Check className="h-3 w-3" />
                  {copyMsg}
                </p>
              )}
              <p className="mt-1 text-[10px] text-muted-foreground">
                Paste into GoDaddy's bulk search to buy.
              </p>
            </div>
            <div className="max-h-[60vh] overflow-y-auto p-3">
              {cart.size === 0 ? (
                <EmptyState
                  icon={ShoppingCart}
                  text="Cart is empty. Tick candidates from the List tab to add."
                />
              ) : (
                <ul className="space-y-4">
                  {Array.from(cartByHuntBranch.entries()).map(([huntId, branches]) => {
                    const huntTitle =
                      Array.from(branches.values())[0]?.[0]?.huntTitle ?? "Hunt";
                    return (
                      <li key={huntId}>
                        <p className="mb-1.5 px-1 text-[11px] font-semibold uppercase tracking-wider text-foreground/70">
                          {huntTitle}
                        </p>
                        <ul className="space-y-3">
                          {Array.from(branches.entries()).map(([branchId, items]) => (
                            <li key={branchId}>
                              <p className="mb-1 px-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                                {items[0].branchName}
                              </p>
                              <ul className="space-y-0.5">
                                {items.map((it) => (
                                  <li
                                    key={it.domain}
                                    className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-accent"
                                  >
                                    <span className="flex-1 truncate font-mono text-[12px] text-foreground">
                                      {it.domain}
                                    </span>
                                    {it.price != null && (
                                      <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
                                        ${it.price.toFixed(0)}
                                      </span>
                                    )}
                                    <button
                                      onClick={() => onRemoveFromCart(it.domain)}
                                      className="text-muted-foreground/60 hover:text-destructive"
                                      title="Remove from cart"
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </button>
                                  </li>
                                ))}
                              </ul>
                            </li>
                          ))}
                        </ul>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}

function EmptyState({
  icon: Icon,
  text,
}: {
  icon: React.ComponentType<{ className?: string }>;
  text: string;
}) {
  return (
    <div className="flex flex-col items-center gap-2 px-2 py-8 text-center">
      <div className="grid h-9 w-9 place-items-center rounded-full bg-accent text-muted-foreground">
        <Icon className="h-4 w-4" />
      </div>
      <p className="text-[12px] text-muted-foreground">{text}</p>
    </div>
  );
}
