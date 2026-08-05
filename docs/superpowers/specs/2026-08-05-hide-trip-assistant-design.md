# Remove Trip Assistant from the UI (keep the backend) — Design

**Date:** 2026-08-05
**Status:** Approved, ready for implementation

## Goal

Take the AI Trip Assistant out of the user-facing UI while leaving its backend fully
functional. The UI will be reworked and brought back later, so the code is preserved in a
tidy place rather than deleted.

## Current state

The assistant is inline in `app/dashboard/trip/[id]/page.tsx` (1188 lines), spread across
four sites:

| Lines | What |
|---|---|
| 31 | `import { Sparkles } from "lucide-react"` |
| 159-170 | `assistantInput`, `assistantLoading`, `assistantError`, `assistantResponse` state |
| 471-505 | `clearAssistant`, `handleAssistantSubmit` |
| 656-786 | `<section aria-labelledby="trip-assistant-title">` markup |

Roughly 150 lines. `Sparkles` is used only at line 663, by the assistant.

The backend is already cleanly separated:

```
app/api/agent/route.ts        POST /api/agent -> runAgent()
  └─ src/lib/agent/runAgent.ts
     ├─ src/lib/agent/planner.ts
     ├─ src/lib/agent/tools/searchPlaces.ts
     └─ src/lib/mock-data/munich-places.json
  └─ src/types/agent.ts
```

None of that is touched.

### Known gaps, deliberately preserved

Two things in the current UI are unfinished. Both move across **unchanged** — they are
product decisions for the rework, not this change's business:

- The card's "Add to trip notes" button is `onClick={() => {}}`, a no-op.
- The request hardcodes `destination: trip.destination ?? "Munich"` and `childrenAges: [4, 5]`.

## Decisions

| Decision | Choice | Reasoning |
|---|---|---|
| Disposition of UI code | Extract to `components/trip/trip-assistant.tsx`, don't render it | The UI is coming back after rework; keeping it in the project means the compiler keeps checking it |
| Fidelity | Move as-is | Pure refactor — nothing to re-verify beyond "still compiles, page looks right without it". Fixing the gaps would mean inventing product intent now |
| Feature flag | No | Nothing needs to toggle it; a flag would leave 150 lines in an already large file for no gain |
| `src/app/api/agent/route.ts` | Delete | Verified dead (below) |

## Changes

### 1. New `components/trip/trip-assistant.tsx`

`"use client"`, following the `TripDashboardSummaryStrip` pattern — owns its own state, takes
a minimal prop interface:

```ts
export interface TripAssistantProps {
  tripId: string;
  destination?: string | null;
}
```

All four state hooks and both handlers move inside. Markup moves verbatim. The only edits are
the mechanical ones encapsulation forces:

- `trip?.id` → `tripId`
- `trip.destination ?? "Munich"` → `destination ?? "Munich"`

The `Sparkles` import moves here too, since the icon is part of the markup being moved.

This is a better boundary than the status quo, where the page owns assistant state — which is
precisely why the feature was tangled across four separate places in the file.

A header comment records that the component is intentionally unrendered and where it used to
mount, so a reader doesn't mistake it for live code.

### 2. `app/dashboard/trip/[id]/page.tsx`

Delete all four sites listed above. No `TripAssistant` import is added — the component is
intentionally not rendered.

Spacing needs no adjustment: the summary strip above carries `mt-6` and the card grid below
carries `mt-8`, so they sit correctly once the section between them is gone.

### 3. Delete `src/app/api/agent/route.ts`

Verified dead:

- `diff` against `app/api/agent/route.ts` reports the files are identical.
- Next.js uses either `app/` or `src/app/` as the router root, never both. Root `app/` exists,
  so `src/app/` is ignored — `next build` lists `/api/agent` exactly once.
- It is the only file under `src/app/`, so the directory is removed with it.

`src/lib/` and `src/types/` are **not** touched — the live route imports
`@/src/lib/agent/runAgent` and `@/src/types/agent` from there. Deleting only the redundant
router wrapper.

## Restoring the UI later

One import plus one line:

```tsx
<TripAssistant tripId={trip.id} destination={trip.destination} />
```

Mount it where the old section was — between `TripDashboardSummaryStrip` and the card grid.

## Why extract instead of delete

An unimported component still sits inside the TypeScript project, and `tsconfig.json`
includes `**/*.tsx`, so `next build` type-checks it. If `AgentRequest` or the response shape
changes, the build fails instead of the code rotting silently. Deleting to git history gives
no such signal.

The honest cost is a file nothing renders, which a reader could mistake for live code. The
header comment is the mitigation.

## Verification

The characteristic failure of a removal like this is a leftover reference — an unused import,
an orphaned state variable, a handler with no caller. Both tools below catch exactly that:

1. `npx eslint app/dashboard/trip/[id]/page.tsx components/trip/trip-assistant.tsx` — clean,
   with no unused-variable warnings beyond any that already existed in the page.
2. `npm run build` — succeeds, and `/api/agent` still appears in the route list.
3. Manual check of a trip dashboard page: no Trip Assistant section, and spacing between the
   summary strip and the card grid looks right.
4. Backend still reachable independently — `POST /api/agent` continues to route to `runAgent`,
   unchanged by any of the above.

### Result: 4 pre-existing lint errors became visible

Removing the assistant made `npx eslint` on the page report 4 `react-hooks/set-state-in-effect`
**errors** where it previously reported none (unused-vars warnings dropped 3 → 2, as expected).

These are not regressions. The flagged statements are untouched by this change and belong to
unrelated effects — trip title, members, destination image, participant avatars:

| After | Statement | Before |
|---|---|---|
| 167 | `if (!id) setTitleError("Missing trip id.")` | 180 |
| 206 | `setMembersLoading(true)` | 219 |
| 412 | `setDestinationImageUrl(null)` | 425 |
| 426 | `setParticipantAvatarUrls([])` | 439 |

Every one sits exactly 13 lines lower before the change — the 12 state lines plus 1 import that
were removed. The rule is React Compiler-based and had been bailing out on this component;
something in the assistant code made it unanalyzable, suppressing the rule for the whole file.
Removing that code let analysis complete and surfaced violations that were always there.

`next build` still succeeds, and the repo has no CI workflows, so nothing is gated by this.
Fixing those four effects is unrelated work and deliberately not done here.

Note: `src/lib/agent/` contains `planner.test.ts`, `runAgent.test.ts`, and
`searchPlaces.test.ts`, but `package.json` defines no test runner, so they cannot be executed.
They are backend files and are left alone. They are, however, a ready-made first target if a
runner is added later.
