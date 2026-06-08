## Goal
Add a user-defined "Max characters" control (counts SLD + TLD including the dot) that filters domain results, similar to how Max Price works today. The AI prompt stays as-is; this is purely a user-controlled filter.

## Changes

### 1. Server — `src/lib/domain-hunter.functions.ts`
- Extend `IterationInput` with optional `maxLength?: number` (int, 5–40).
- If provided, pass it into `generateIdeas` and filter generated ideas where `domain.length > maxLength` before sending to GoDaddy (saves API calls). No prompt-tightening — just a post-filter.
- If not provided, behavior is unchanged.

### 2. Client — `src/routes/index.tsx`
- Add a `maxLength` numeric input next to the existing Max Price field in the Hunt setup card. Empty / unset = no limit. Persist on the `Hunt` object alongside `prompt`, `tlds`, `maxPrice`.
- Pass `maxLength` into every `runIteration` call (omit when blank).
- Apply `maxLength` to the same client-side "eligible" filters that price uses today:
  - "Within budget" metric tile (extend to also respect length).
  - BranchCard inline available list.
  - BranchDetail Available section.
  - List tab in the right sidebar.
  - `selectAllInBranch` helper.
- Surface the active filters in the header (e.g. "≤ 18 chars · ≤ $50") so it's clear why some results are hidden.

### Out of scope
- No changes to the AI prompt wording.
- No persistence/DB changes.
- Cart contents are not retroactively filtered.

## Files touched
- `src/lib/domain-hunter.functions.ts`
- `src/routes/index.tsx`
