# Domain Manager: missing domains, status summary, pages

## 1. Add missed domains from your sheet
Your sheet lists 124 domains across 7 accounts (GoDaddy Main 57, Namecheap Dead Account 38, Alyson Client Account 13, CC Account 9, 101domain 5, GoDaddy Content Cognition 1, GoDaddy Dead Account 1).

- Every sheet domain is compared with what the registrars return live.
- Any domain the live accounts did not return is added to the list with its sheet details: registrar, account username, account email, account name (the sheet's "Account Type", e.g. "Alyson Client Account"), expiry, status, auto-renew, privacy, importance and category. Brand spellings are corrected ("NameCheap" shows as "Namecheap").
- Domains that came back live keep their live data, but get the sheet's account name, importance and category filled in where missing.
- Rows added from the sheet get a small "From sheet" tag, so you can tell they don't update by themselves.
- After it's built, I'll tell you how many domains were missing and from which accounts.
- Expired domains in the sheet still go to the hidden "Show expired domains" section.

## 2. Status summary under the table
A row of cards right after the table, counting only non-expired domains:
- **Total domains**
- **Due in 30 days**, **Due in 31–60 days** and **Due in 61–90 days**: how many domains expire in each window. Clicking one lists those domains as tasks to renew.
- The counts follow the current search and filters.

## 3. Pages and "show per page"
- A drop-down under the table to show **10, 50, 100 or All** domains at a time. The default is 50.
- Previous/Next buttons and "Page X of Y". The page resets to 1 when you search, filter or sort.
- The CSV download still exports every row that matches your filters, not just the current page.

Nothing else on the page or in the app changes.

## Technical details
- The sheet is converted into a typed data module (`src/lib/dmd/domain-sheet.ts`) and loaded inside `getManagedDomains`, merged by lowercase domain after live results (live wins; sheet fills nulls). The registrar comes from Registrant/Account Type (a blank Registrant with a GoDaddy account type means GoDaddy). Dates like "Dec 19 2027" are parsed to ISO. `ManagedDomain` gains `source: "api" | "sheet"`. This replaces the hard-coded 101domain list.
- Summary and pagination are computed client-side in `_app.domain-manager.tsx` from the filtered, non-expired rows.
