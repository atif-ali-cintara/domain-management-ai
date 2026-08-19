# Consolidated Email Communication

A new page that pulls unread mail from all the G-Suite mailboxes listed on Account Access, groups it by priority category, and lets you read the full email (which marks it read in Gmail too). Nothing existing is changed or removed — this is purely additive.

## What I need from you

One Google Cloud OAuth client (works for every mailbox, across all the different company domains):

1. In Google Cloud Console, create a project (or reuse one) and enable the **Gmail API**.
2. Create an **OAuth 2.0 Client ID** of type *Web application*.
3. Add these Authorized redirect URIs:
   - `https://domain-management-ai.lovable.app/api/public/google/callback`
   - `https://id-preview--f937e101-d43e-43cb-8247-be50a26cefa0.lovable.app/api/public/google/callback`
4. On the OAuth consent screen, add the scopes `gmail.readonly` and `gmail.modify`, and add each mailbox owner as a test user (or publish the app).
5. Send me the **Client ID** and **Client Secret** — I'll store them as encrypted project secrets.

After that, you click **Connect** next to each G-Suite address on the new page and sign in once with Google for that mailbox. Refresh tokens are stored encrypted, so you only do it once per mailbox.

Note: several mailboxes on Account Access are personal `@gmail.com` registrant addresses rather than G-Suite. The page lists every mailbox it finds; you choose which ones to connect.

## The page

Route: `/consolidated-email` — sidebar item "Consolidated Email Communication", visible to the same admins who can see Account Access.

Layout:

```text
[ Connected mailboxes: 6/14  •  Refresh  •  filter by mailbox ]

CRITICAL (3)
  ▸ Namecheap Billing   Payment failed for ...   [action: update card]  [mailbox]
IMPORTANT (7)
INFORMATIONAL (12)
NOT IMPORTANT (4)
PROMOTION (23)
JUNK (9)
```

- Each row: sender, subject, one-line AI summary, action required, mailbox badge, received time.
- Click a row → full email opens in a reading pane (HTML rendered safely), and the message is marked read in Gmail via the API.
- **Keep open**: a pin toggle on any email. Pinned/action-pending emails stay on the page after being read, until you dismiss them.
- Sync scope: unread messages only, plus anything you've kept open — matching your requirement.
- Refresh is on-demand (button), with a per-mailbox last-synced timestamp.

## Categorization

- Gmail's own signals first: `CATEGORY_PROMOTIONS` → Promotion, `SPAM` → Junk.
- Everything else goes to Lovable AI, which returns `{ category, summary, action_required }` for each message from its sender/subject/snippet.
- Results are cached per message so a refresh doesn't re-pay for already-classified mail.

## Technical notes

- New tables (with RLS + grants, admin-only read/write):
  - `email_accounts` — mailbox address, display label, linked company, encrypted refresh token, last sync time, status.
  - `email_messages` — gmail message id, account id, sender, subject, snippet, received_at, category, summary, action_required, is_read, is_pinned, dismissed.
- Secrets: `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET` (I'll add once you provide them). Refresh tokens are encrypted at rest with the existing `ACCOUNT_VAULT_KEY` / `vault.server.ts` helpers.
- OAuth start + callback as public server routes under `src/routes/api/public/google/*` (state parameter signed and verified; callback verifies the signed-in admin session before storing the token).
- New `src/lib/email-inbox.functions.ts` server functions: `listMailboxes`, `startOAuth`, `syncMailbox`, `listMessages`, `openMessage` (fetch full body + `users.messages.modify` removing `UNREAD`), `pinMessage`, `dismissMessage` — all behind the same admin role check used by Account Access.
- New UI in `src/components/dmd/Email/` plus route `src/routes/_app.consolidated-email.tsx`; one nav entry appended to `AppShell`. No other file is modified.
- Email HTML is sanitized and rendered in a sandboxed iframe with remote images blocked by default.
