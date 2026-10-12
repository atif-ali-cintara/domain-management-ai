import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  listMailboxes,
  startGmailConnect,
  syncInboxes,
  listInboxMessages,
  openInboxMessage,
  updateInboxMessage,
  disconnectMailbox,
  type Mailbox,
  type InboxMessage,
} from "@/lib/email-inbox.functions";
import { getMyRoles } from "@/lib/auth.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Mail, RefreshCw, Pin, PinOff, X, ShieldAlert, Link2, Unlink } from "lucide-react";

export const Route = createFileRoute("/_app/consolidated-email")({
  head: () => ({
    meta: [
      { title: "Consolidated Email Communication — Alyson" },
      { name: "description", content: "Unread mail from every company G-Suite inbox, triaged by priority." },
      { property: "og:title", content: "Consolidated Email Communication — Alyson" },
      { property: "og:description", content: "Unread mail from every company G-Suite inbox, triaged by priority." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ConsolidatedEmailPage,
});

const CATS: { key: string; label: string; tone: string }[] = [
  { key: "critical", label: "Critical", tone: "bg-[color:var(--status-critical)] text-primary-foreground" },
  { key: "important", label: "Important", tone: "bg-primary text-primary-foreground" },
  { key: "informational", label: "Informational", tone: "bg-secondary text-secondary-foreground" },
  { key: "not-important", label: "Not important", tone: "bg-muted text-muted-foreground" },
  { key: "promotion", label: "Promotion", tone: "bg-accent text-accent-foreground" },
  { key: "junk", label: "Junk", tone: "bg-muted text-muted-foreground" },
];

type Opened = { from: string; to: string; subject: string; date: string; html: string | null; text: string };

function ConsolidatedEmailPage() {
  const fRoles = useServerFn(getMyRoles);
  const fBoxes = useServerFn(listMailboxes);
  const fConnect = useServerFn(startGmailConnect);
  const fSync = useServerFn(syncInboxes);
  const fList = useServerFn(listInboxMessages);
  const fOpen = useServerFn(openInboxMessage);
  const fUpdate = useServerFn(updateInboxMessage);
  const fDisconnect = useServerFn(disconnectMailbox);

  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [boxes, setBoxes] = useState<Mailbox[]>([]);
  const [msgs, setMsgs] = useState<InboxMessage[]>([]);
  const [mailboxFilter, setMailboxFilter] = useState("all");
  const [syncing, setSyncing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [selected, setSelected] = useState<InboxMessage | null>(null);
  const [opened, setOpened] = useState<Opened | null>(null);
  const [opening, setOpening] = useState(false);

  const reload = useCallback(async () => {
    const [b, m] = await Promise.all([fBoxes(), fList()]);
    setBoxes(b);
    setMsgs(m);
  }, [fBoxes, fList]);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    if (p.get("connected")) setNotice(`Connected ${p.get("connected")}`);
    if (p.get("connect_error")) setNotice(`Connection failed: ${p.get("connect_error")}`);
    (async () => {
      try {
        const r = await fRoles();
        setAuthorized(!!r.isSuperAdmin);
        if (r.isSuperAdmin) await reload();
      } catch (e: any) {
        setNotice(e.message);
        setAuthorized(false);
      }
    })();
  }, [fRoles, reload]);

  async function connect(hint: string | null) {
    try {
      const { url } = await fConnect({ data: { origin: window.location.origin, hint } });
      window.open(url, "_top");
    } catch (e: any) {
      setNotice(e.message);
    }
  }

  async function refresh() {
    setSyncing(true);
    setNotice(null);
    try {
      const res = await fSync();
      const errs = res.filter((r) => r.error);
      const added = res.reduce((n, r) => n + r.added, 0);
      setNotice(`${added} new email(s)` + (errs.length ? ` — ${errs.length} mailbox error(s)` : ""));
      await reload();
    } catch (e: any) {
      setNotice(e.message);
    } finally {
      setSyncing(false);
    }
  }

  async function openMsg(m: InboxMessage) {
    setSelected(m);
    setOpened(null);
    setOpening(true);
    try {
      const o = await fOpen({ data: { id: m.id } });
      setOpened(o);
      setMsgs((xs) => xs.map((x) => (x.id === m.id ? { ...x, is_read: true } : x)));
    } catch (e: any) {
      setNotice(e.message);
    } finally {
      setOpening(false);
    }
  }

  async function togglePin(m: InboxMessage) {
    await fUpdate({ data: { id: m.id, is_pinned: !m.is_pinned } });
    setMsgs((xs) => xs.map((x) => (x.id === m.id ? { ...x, is_pinned: !m.is_pinned } : x)));
  }

  async function dismiss(m: InboxMessage) {
    await fUpdate({ data: { id: m.id, dismissed: true } });
    setMsgs((xs) => xs.filter((x) => x.id !== m.id));
    if (selected?.id === m.id) setSelected(null);
  }

  // Unread, or read but kept open.
  const visible = useMemo(
    () =>
      msgs.filter(
        (m) => (mailboxFilter === "all" || m.mailbox === mailboxFilter) && (!m.is_read || m.is_pinned || selected?.id === m.id),
      ),
    [msgs, mailboxFilter, selected],
  );

  if (authorized === null) return <div className="text-sm text-muted-foreground">Loading…</div>;
  if (!authorized)
    return (
      <Card>
        <CardContent className="flex items-center gap-3 py-8 text-sm">
          <ShieldAlert className="h-5 w-5" /> This page is restricted to admins with Account Access.
        </CardContent>
      </Card>
    );

  const connectedCount = boxes.filter((b) => b.connected).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Consolidated Email Communication</h1>
          <p className="text-sm text-muted-foreground">
            Unread mail across company inboxes · {connectedCount}/{boxes.length} mailboxes connected
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            className="h-9 rounded-md border border-border bg-background px-2 text-sm"
            value={mailboxFilter}
            onChange={(e) => setMailboxFilter(e.target.value)}
          >
            <option value="all">All mailboxes</option>
            {boxes.filter((b) => b.connected).map((b) => (
              <option key={b.email} value={b.email}>{b.email}</option>
            ))}
          </select>
          <Button onClick={refresh} disabled={syncing || !connectedCount}>
            <RefreshCw className={`h-4 w-4 mr-1 ${syncing ? "animate-spin" : ""}`} /> Refresh
          </Button>
        </div>
      </div>

      {notice && <div className="rounded-md border border-border bg-muted px-3 py-2 text-sm">{notice}</div>}

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Mailboxes</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {boxes.map((b) => (
            <div key={b.email} className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2 last:border-0 text-sm">
              <div>
                <div className="font-medium">{b.email}</div>
                <div className="text-xs text-muted-foreground">
                  {b.company_name ?? "—"}
                  {b.last_synced_at && ` · synced ${new Date(b.last_synced_at).toLocaleString()}`}
                  {b.last_error && <span className="text-[color:var(--status-critical)]"> · {b.last_error}</span>}
                </div>
              </div>
              {b.connected ? (
                <Button variant="ghost" size="sm" onClick={async () => { await fDisconnect({ data: { email: b.email } }); reload(); }}>
                  <Unlink className="h-3.5 w-3.5 mr-1" /> Disconnect
                </Button>
              ) : (
                <Button variant="outline" size="sm" onClick={() => connect(b.email)}>
                  <Link2 className="h-3.5 w-3.5 mr-1" /> Connect
                </Button>
              )}
            </div>
          ))}
          <Button variant="ghost" size="sm" onClick={() => connect(null)}>+ Connect another mailbox</Button>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <div className="space-y-4">
          {CATS.map((c) => {
            const items = visible.filter((m) => m.category === c.key);
            return (
              <Card key={c.key}>
                <CardHeader className="pb-2 flex-row items-center gap-2 space-y-0">
                  <Badge className={c.tone}>{c.label}</Badge>
                  <span className="text-sm text-muted-foreground">{items.length}</span>
                </CardHeader>
                <CardContent className="space-y-1">
                  {items.length === 0 && <div className="text-xs text-muted-foreground">Nothing here.</div>}
                  {items.map((m) => (
                    <div
                      key={m.id}
                      onClick={() => openMsg(m)}
                      className={`cursor-pointer rounded-md border p-2 text-sm hover:bg-muted ${selected?.id === m.id ? "border-primary" : "border-border"}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className={`truncate ${m.is_read ? "" : "font-semibold"}`}>{m.subject || "(no subject)"}</div>
                          <div className="truncate text-xs text-muted-foreground">{m.sender}</div>
                        </div>
                        <div className="flex shrink-0 items-center gap-1" onClick={(e) => e.stopPropagation()}>
                          <button title={m.is_pinned ? "Stop keeping open" : "Keep open"} onClick={() => togglePin(m)} className="p-1 text-muted-foreground hover:text-foreground">
                            {m.is_pinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
                          </button>
                          <button title="Dismiss" onClick={() => dismiss(m)} className="p-1 text-muted-foreground hover:text-foreground">
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                      <div className="mt-1 text-xs">{m.summary}</div>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                        {m.action_required && m.action_required !== "None" && (
                          <span className="font-medium text-foreground">Action: {m.action_required}</span>
                        )}
                        <span>{m.mailbox}</span>
                        {m.received_at && <span>{new Date(m.received_at).toLocaleString()}</span>}
                        {m.is_pinned && <Badge variant="outline" className="text-[10px]">kept open</Badge>}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Card className="lg:sticky lg:top-20 h-fit">
          <CardContent className="py-4">
            {!selected ? (
              <div className="flex flex-col items-center gap-2 py-16 text-sm text-muted-foreground">
                <Mail className="h-6 w-6" /> Select an email to read it.
              </div>
            ) : opening ? (
              <div className="py-16 text-center text-sm text-muted-foreground">Loading email…</div>
            ) : opened ? (
              <div className="space-y-3">
                <div>
                  <div className="text-lg font-semibold">{opened.subject}</div>
                  <div className="text-xs text-muted-foreground">From {opened.from} · To {opened.to} · {opened.date}</div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => togglePin(selected)}>
                    {msgs.find((x) => x.id === selected.id)?.is_pinned ? "Stop keeping open" : "Keep open (action pending)"}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => dismiss(selected)}>Done</Button>
                </div>
                {opened.html ? (
                  <iframe
                    title="Email"
                    sandbox=""
                    className="h-[600px] w-full rounded-md border border-border bg-background"
                    srcDoc={`<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:">${opened.html}`}
                  />
                ) : (
                  <pre className="whitespace-pre-wrap text-sm">{opened.text}</pre>
                )}
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
