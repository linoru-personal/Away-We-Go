# Image loading: lazy-load collections, keep raw `<img>` — Design

**Date:** 2026-08-05
**Status:** Implemented

## The finding that shaped this

This work started as "replace 21 raw `<img>` tags with `next/image`", based on a count of
`@next/next/no-img-element` lint warnings. Reading the actual pipeline showed that premise was
wrong: **images in this app are already optimized.**

- **Gallery photos** — `app/api/trips/[tripId]/photos/route.ts:126-143` runs sharp on upload and
  writes two variants, both **WebP at quality 85**: a 300px thumbnail and a 1600px display copy,
  with EXIF orientation corrected via `.rotate()`.
- **Covers and avatars** — cropped to the fixed output sizes in `lib/image-presets.ts`
  (960px trip hero, 960×160 destination banner, 256px square avatar).
- **Layout shift** — photo grids already wrap images in `aspect-square` containers.

Resizing and modern formats are `next/image`'s two main jobs, and both were already handled
server-side at upload time.

**What was actually missing was lazy loading.** No image anywhere in the app had a `loading`
attribute — verified by grepping every `loading=` in the codebase, whose only hit was an
unrelated boolean prop. `components/trips/photos/photos-section.tsx` maps over photos unbounded,
so a trip with 60 photos fetched all 60 thumbnails on page load. At roughly 15KB each that is
~900KB of immediate, mostly-offscreen traffic — the real cost, from a different cause than the
one originally assumed.

## Decision: do not adopt `next/image`

Beyond being redundant here, it would cost money to make things slightly worse.

Storage URLs are **signed with a 1-hour expiry** (`lib/trip-media/resolve-cover.ts`,
`lib/editable-image-assets/get-source.ts`). The Next image optimizer caches by URL, so a
rotating signature means a rotating cache key: Vercel would bill a fresh transformation on every
rotation, in order to re-encode already-optimal WebP.

Consequence: the `@next/next/no-img-element` warnings are permanently unactionable, so the rule
is turned off in `eslint.config.mjs` with the reasoning inline. Left enabled, they would be 21 of
72 warnings that nobody will ever fix — which is how genuine warnings get missed. Turning it off
plus removing the 4 orphaned inline directives took warnings from 72 to 51.

Accepted trade-off: if someone later adds an image where `next/image` genuinely is the better
choice, the linter will not nudge them. Given the upload pipeline, that is unlikely enough to
accept.

## The rule applied

**Lazy-load images that can appear in unbounded or scrollable collections. Keep eager anything
that is a single prominent image or a preview of something the user just chose.**

### The count was wrong at first: 25 images, not 21

Turning the rule off surfaced 4 `<img>` tags that had **inline** `eslint-disable-next-line`
comments, so they never appeared in the warning count this work was scoped from. They were found
only because disabling the rule made those directives report as unused:

| File | Verdict |
|---|---|
| `dashboard/dashboard-sidebar.tsx` | Lazy — trip thumbnails in the sidebar list |
| `notes/trip-notes-section.tsx:245` | Lazy — note image thumb/grid |
| `notes/trip-notes-section.tsx:639` | **Eager** — full-screen lightbox |
| `ui/link-preview-thumbnail.tsx` | Lazy — link preview thumb in lists |

The lightbox is the interesting one: the user clicked precisely to see that image, so deferring
it would delay the only thing they asked for. Same principle as the dialog previews.

All four inline directives were removed, since the rule they suppress is now off globally.

Lesson worth keeping: a lint-warning count understates the real surface whenever inline disables
are in play. Turn the rule off first, then count.

### Lazy — 15 images

| File | Why |
|---|---|
| `trips/photos/photos-section.tsx` | The photo grid. The reason for this work. |
| `notes/trip-notes-section.tsx` | Note thumbnails in a list |
| `notes/trip-notes-summary-card.tsx` | Thumbnail in a below-fold summary card |
| `budget/add-currency-dialog.tsx` | ~150 flags from an external CDN in a scrolling list |
| `ui/link-favicon.tsx` | Favicons in link lists |
| `trips/trip-card.tsx` (×2) | Dashboard card covers and participant avatars |
| `packing/packing-list.tsx` (×3) | Participant avatars in filters and group headers |
| `tasks/tasks-section.tsx` | Participant avatar in filters |
| `packing/packing-summary-card.tsx` | Participant avatar |

Native lazy loading is viewport-aware, so images that happen to be visible still load
immediately — marking a collection lazy cannot starve the part of it that is on screen.

### Eager — 10 images, deliberately

| File | Why it must not be lazy |
|---|---|
| `trips/photos/photos-summary-card.tsx` (×2) | An opacity **crossfade pair**. Deferring a load would flash or break the fade. |
| `trips/trip-form-modal.tsx` (×3) | Previews of a file the user just picked — expected instantly |
| `notes/add-trip-note-dialog.tsx` | Same: blob previews of just-attached images |
| `app/dashboard/trip/[id]/page.tsx` | Large destination banner high on the page; an LCP candidate, and lazy-loading the LCP element hurts the metric this work exists to improve |
| `trip/trip-hero.tsx` | Participant avatars inside the above-fold hero |
| `emails/trip-invitation-email.tsx` | An email. Mail clients do not support the attribute; this file is not a browser context at all. |

`decoding="async"` was considered and skipped as noise — browsers handle that well by default.

## Verification

1. `npx tsc --noEmit` — clean.
2. `npm run build` — succeeds.
3. The 12/9 split confirmed programmatically against the lint rule's own file list, rather than
   by eye.
4. Manual, in a browser: DevTools → Network → Img on a trip's Photos page shows only in-view
   thumbnails on load, with more requests firing on scroll. Confirmed.

## Not done, and why

Shrinking the 256px avatar preset was considered — those render into 28-36px circles, so the
source is far larger than needed. Skipped because changing the preset only affects **new**
uploads; existing avatars stay 256px unless re-uploaded, and a 256px WebP avatar is only
~10-20KB. Small real gain for a schema and upload change.
