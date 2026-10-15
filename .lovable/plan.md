# Domain Manager page

A new sidebar page, **Domain Manager**, that pulls every domain from your Namecheap, GoDaddy and 101domains accounts. It shows them in one searchable table. Click any domain to see its full details.

## What you'll see
- **Summary row:** total domains, how many are with each registrar, domains expiring in 30, 60 or 90 days, and domains with auto-renew off.
- **Domain table:** domain, registrar, account, status, expiry date (with days left and a colour warning), auto-renew, privacy, lock, and nameservers.
- **Filters:** search, registrar, account, status, and an expiring-soon filter. You can also sort columns and export the table as a CSV file.
- **Domain details panel** (opens on click):
  - Registrant, admin, tech and billing contacts (name, organisation, email, phone, address).
  - Created, expiry and last-updated dates.
  - Nameservers, lock and privacy status, and auth/transfer status where the registrar provides it.
  - The matching company and identity from your existing records.
- **Connection status bar:** shows whether each registrar account connected or failed, with the reason. For example, if Namecheap rejects the server address, the bar shows the new address to whitelist.
- **Refresh button.** Results are cached for a few minutes so the page loads quickly.

## What I need from you
- **101domains:** API access isn't set up yet. You'll need to request it from 101domains support (it usually requires a reseller or API-enabled account). Then send me the API key, and the username if they give you one, through the secure form. Until then, 101domains will show "Not connected" and the other two registrars will work as normal.
- **GoDaddy:** this uses the keys you already saved. GoDaddy only allows full domain and contact details for accounts with 50+ domains or an API plan. If it refuses, the page will show this clearly.
- **Namecheap:** this uses both connected accounts (Revcloud/Bill Raney and MohitaContentCogniti). The current server address must stay whitelisted in both.

## What stays the same
Nothing existing changes. The Dashboard, Domains page, Domain Hunter and everything else keep working as they do now.

## Technical details
- New `src/lib/domain-manager.functions.ts` (server function, gated to signed-in users):
  - GoDaddy: `GET /v1/domains` (paginated), then `GET /v1/domains/{domain}` per domain for contacts, nameservers and flags. Runs at most 5 requests at once.
  - Namecheap: `domains.getList` per account, then `domains.getContacts` and `domains.getInfo` per domain, with limited parallel requests. Uses the existing XML parsing helpers and IP detection.
  - 101domains: their reseller REST API (domain list + domain info), behind `ONEOONE_DOMAINS_API_KEY`. It is skipped with a "not connected" status if the key is missing.
  - Each registrar's data is normalised to a shared `ManagedDomain` shape. Errors are returned per account and never thrown.
  - Contacts load only when the details panel opens (a separate `getDomainDetails` call), so the list stays fast.
- New route `src/routes/_app.domain-manager.tsx` with head metadata, using TanStack Query for the list and details.
- AppShell nav: add "Domain Manager" under Domains.
- No database changes.
