# Domain Hunter: check availability through the Namecheap account

## Why everything still says "Unknown (RDAP 403)"
The public registry lookup services refuse requests coming from the app's hosting network, so every check comes back blocked. Namecheap's own availability check does not have this problem, but it only answers requests from computer addresses you have approved (whitelisted) in the Namecheap account.

## What I will do (Domain Hunter only, nothing else changes)
1. **Reconnect the Bill Raney / Revcloud Namecheap account.** I'll open a secure form so you can re-enter its API key and username. You don't need to paste them in chat.
2. **Use Namecheap as the main availability check.** Names are sent in groups of up to 50 to Namecheap's own "is this domain available?" check on that account. Its answer of available or taken is final, and premium domains show their real price.
3. **Keep the backups.**
   - If Namecheap rejects the request, the app falls back to the web-settings check. Names with no web settings show as "Likely available"; names with live settings show as "Taken".
   - The registry lookup stays as a last resort.
4. **Show which check answered.** Each result gets a small label (Namecheap, web settings, or registry). If Namecheap rejects the request because the app's address isn't approved, you'll see a clear message with the exact address to whitelist.

## What I need from you
- Re-enter the Revcloud Namecheap key in the secure form when it appears.
- In Namecheap, go to Profile, then Tools, then API Access, then Whitelisted IPs, and add the address the app shows.

**Limitation:** the app's hosting can switch to a different address over time. When it does, Namecheap checks stop until the new address is whitelisted. The "Likely available" backup keeps results coming in the meantime. The only permanent fix is to route requests through a fixed address (a small paid relay service), which we can do as a follow-up.

## Technical details
- `src/lib/domain-hunter.functions.ts`: add `namecheapCheck(domains[])` calling `namecheap.domains.check` with NAMECHEAP_API_USER / NAMECHEAP_API_KEY, ClientIp detected from `https://api.ipify.org`. Parse `<DomainCheckResult Domain Available IsPremiumName PremiumRegistrationPrice>`. Read the IP-rejection error (code 1011150) and return the detected IP.
- In `runIteration` / `recheckDomain`: batch Namecheap first, then for unresolved names use `dnsCheck` (NXDOMAIN gives `available: true, source: "dns"`, taken gives false), then RDAP.
- Add an optional `source` field to `DomainResult`; HunterPage shows the badge plus a whitelist-IP banner. Filtering, budget and cart logic stay as they are.
- Update the secrets with the secrets update tool (`NAMECHEAP_API_KEY`, `NAMECHEAP_API_USER`).
