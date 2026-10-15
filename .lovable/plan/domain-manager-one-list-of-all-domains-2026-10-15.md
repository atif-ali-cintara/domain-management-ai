# Domain Manager: one list of all domains

A new sidebar page, **Domain Manager**, with one table of every domain across your Namecheap, GoDaddy and 101domains accounts.

## Table columns
Domain, registrar, account username, contact email, expiry date (with days left and a colour warning), status, and auto-renew.

## Sorting and filtering
- Sort by **account username**, **contact email** or **expiry date**. Click a column heading to sort; click it again to reverse the order. Other columns can be sorted too.
- A search box, plus quick filters for registrar and account.
- A Refresh button and a CSV download of the list as shown.
- A small note at the top lists any account that couldn't load, and why.

## What I need from you
- **101domains:** an API key, and the username if they provide one. You request these from 101domains support, then send them to me through the secure form. Until then, 101domains shows as "Not connected" and the other two registrars still load.
- **GoDaddy and Namecheap:** these use the accounts already connected.
  - Namecheap must keep the current server address whitelisted.
  - GoDaddy only shares contact emails for accounts it approves for API access. If it refuses, that column shows "—" for GoDaddy domains.

## What stays the same
Nothing else changes, including the current Domains page.

## Technical details
- `src/lib/domain-manager.functions.ts`: an auth-gated server function that returns `{ domain, registrar, accountUsername, contactEmail, expires, expiresInDays, status, autoRenew }[]` plus a list of errors for each account.
  - GoDaddy: `GET /v1/domains` gives the list. Registrant emails come from `GET /v1/domains/{d}`, with at most 5 requests at once.
  - Namecheap: `domains.getList` for each account, then `domains.getContacts` for the registrant email, with limited parallel requests.
  - 101domains: their reseller API, using the `ONEOONE_DOMAINS_API_KEY` secret. Skipped if the secret is missing.
- `src/routes/_app.domain-manager.tsx`: TanStack Query, sorting in the browser, head metadata.
- AppShell: add a nav item under Domains.
- No database changes.
