# Domain Status Checker page

A new sidebar page, **Domain Checker**, where you paste a list of domains and get each one's status.

## What you can do
- Paste domains into a box: one per line, or separated by commas or spaces. Up to 200 at a time. Extra text like `https://` or `www.` is removed automatically, and duplicates are ignored.
- Press **Check status**. Results fill in as they come back, with a progress bar.

## What each row shows
- **Domain** and its character count
- **Availability:** Available, Taken, Premium (with price), or Unknown (with a Recheck button)
- **Source:** Namecheap, DNS or registry, using the same checker as Domain Hunter
- **In our portfolio?** If the domain is in one of your connected accounts or the master sheet, the row shows its account name, registrar, expiry date and days left, with Expired / Due in 30 days highlighted
- **Register** link to Namecheap for available domains

## Extras
- Filter tabs: All / Available / Taken / Ours / Unknown
- Download the results as a CSV
- Copy all available domains with one click

## Technical details
- New route `src/routes/_app.domain-checker.tsx` plus a sidebar link in `AppShell.tsx`.
- New server function `checkDomainList` in `src/lib/domain-checker.functions.ts`, protected so only signed-in users can call it. It reuses the existing `checkMany` availability pipeline (Namecheap first, then DNS, then RDAP) and matches the domains against the Domain Manager data, which is cached for 10 minutes.
- Domains are sent in batches of 25, so results show up while the rest are still being checked.
- Domain Hunter, Domain Manager and every other page stay unchanged.
