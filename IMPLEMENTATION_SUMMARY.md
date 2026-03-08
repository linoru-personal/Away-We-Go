# Away We Go – Implementation Summary (Audit)

## 1. Tech stack

- **Framework:** Next.js 14.2.5 (App Router)
- **UI:** React 18.2
- **Backend / DB:** Supabase (auth, Postgres, storage, RLS)
- **Styling:** Tailwind CSS v4 (`@tailwindcss/postcss`, `@import "tailwindcss"` in CSS)
- **Language:** TypeScript 5
- **No** React Query, SWR, or global state library

---

## 2. App structure / main folders

```
app/                    # Routes and layout
  layout.tsx            # Root layout (Inter font, globals.css)
  page.tsx              # Landing / login
  globals.css
  lib/                  # supabaseClient, useSession, useProfile
  api/                  # Route handlers: /api/fx, /api/link-preview
  dashboard/            # Dashboard and trip sub-routes
components/
  account/              # account-settings-modal
  budget/               # budget-page, dialogs, queries, money, utils
  notes/                # add-trip-note-dialog, trip-notes-section, trip-notes-summary-card
  packing/              # packing-list, packing-summary-card
  tasks/                # tasks-section, add-task-dialog, tasks-summary-card, segmented-control
  trip/                 # trip-hero, section-card
  trips/                # trip-card, trip-form-modal, create-trip-dialog, create-first-trip-card, create-trip-card
  ui/                   # dialog, button, card, progress, emoji-icon-picker, category-icon-choices
supabase/
  migrations/           # SQL migrations (trips, members, tasks, participants, notes, budget, currencies, storage)
```

---

## 3. Routing structure

| Route | Purpose |
|-------|---------|
| `/` | Landing; login form; redirect to `/dashboard` if session exists |
| `/dashboard` | Trip list (tabs: all / upcoming / past), create trip, account |
| `/dashboard/trip/[id]` | Trip dashboard: hero, destination, Tasks/Notes/Packing/Budget summary cards, Photos placeholder, share/edit/delete |
| `/dashboard/trip/[id]/tasks` | Full tasks list + add/edit (TripHero + TasksSection) |
| `/dashboard/trip/[id]/notes` | Full notes (TripHero + TripNotesSection) |
| `/dashboard/trip/[id]/packing` | Packing list (TripHero + PackingList) |
| `/dashboard/trip/[id]/budget` | Budget (TripHero + BudgetPage) |
| `/api/fx` | GET; FX rate (e.g. Frankfurter) for budget |
| `/api/link-preview` | GET; link preview for note links |

---

## 4. Main trip-related pages and components

- **Trip dashboard** (`app/dashboard/trip/[id]/page.tsx`): Fetches trip, participants (signed URLs), cover image; renders TripHero, summary cards (Tasks, Notes, Packing, Budget), Photos placeholder card, Share/Edit/Delete modals.
- **Trip sub-pages:** Each of tasks, notes, packing, budget is a page that fetches trip + participants, renders TripHero + one main section component; back goes to `/dashboard/trip/[id]` (notes/packing/budget) or dashboard (trip page has its own back).
- **Key components:** `TripHero` (cover, title, dates, back, participants), `SectionCard` (title/subtitle/right/children), `TripFormModal` (create/edit trip, participants, cover upload), `TripCard` (dashboard list item). Summary cards: `TasksSummaryCard`, `TripNotesSummaryCard`, `PackingSummaryCard`, `BudgetSummaryCard` (each fetches its own data by `tripId`).

---

## 5. Data model (from migrations + code)

- **Trips:** `trips` – id, user_id, title, destination, start_date, end_date, cover_image_path, created_at. RLS via `has_trip_access` / `is_trip_owner`.
- **Trip members:** `trip_members` (trip_id, user_id). RPCs: `share_trip`, `unshare_trip`, `get_trip_members`.
- **Tasks:** `tasks` – id, trip_id, user_id, title, status (todo|in_progress|done), assignee, created_at.
- **Trip participants:** `trip_participants` – id, trip_id, name, avatar_path, sort_order (avatars in storage bucket).
- **Packing:** Used in code: `packing_categories` (id, trip_id, name, icon, sort_order), `packing_items` (id, trip_id, category_id, title, quantity, is_packed, assigned_to_participant_id). RPC `ensure_default_packing_categories`. (No packing migration in the audited migrations folder; schema inferred from code.)
- **Notes:** `trip_notes` – id, trip_id, title, content (jsonb), tags (text[]), created_at, updated_at. Content has `blocks`: text, list, link, image (path + bucket).
- **Budget:** `trip_budget_categories` (id, trip_id, name, color, icon); `trip_budget_items` (id, trip_id, category_id, name, amount, currency, amount_base, base_currency, fx_rate, date, notes); `trip_currencies`; `trip_exchange_rates` (from_currency, to_currency, rate).
- **Photos:** No table or API. Trip dashboard shows a static “Photos” card with “0 photos” and placeholder gray boxes.
- **Places:** No table or feature in the codebase.

**Storage:** Buckets `trip-covers`, `trip-notes`, `avatars` (private; RLS by trip/access).

---

## 6. Where styling is defined

- **Global:** `app/globals.css` – `@import "tailwindcss"`, `:root` (--background, --foreground), `@theme inline` (colors, font-sans, font-mono), dark mode media query, body base.
- **Tailwind:** No `tailwind.config.js`; Tailwind v4 driven by globals.css and utility usage.
- **Component-level:** Inline Tailwind classes only. Reused strings (e.g. input styles, card class) are local constants (e.g. `INPUT_CLASS`, `CARD_CLASS`, `LABEL_CLASS`) in the same file.
- **Design tokens:** No shared token file. Recurring hex values in components: `#E07A5F` / `#d97b5e` (primary/CTA), `#4A4A4A` (text), `#6B7280` / `#9B7B6B` (muted), `#F5F3F0` / `#FAFAF8` (bg), `#D4C5BA` / `#ebe5df` (borders), `#f6f2ed` (inputs).

---

## 7. Reusable UI components

- **`components/ui/dialog.tsx`** – Modal wrapper (DialogContent with overlay, close).
- **`components/ui/button.tsx`** – Button with variants (e.g. default, destructive).
- **`components/ui/card.tsx`** – Card layout (CardSection, etc.).
- **`components/ui/progress.tsx`** – Progress bar.
- **`components/ui/emoji-icon-picker.tsx`** – Emoji grid picker (portal, used for category icons).
- **`components/ui/category-icon-choices.ts`** – Shared emoji list constant.
- **`components/trip/section-card.tsx`** – Section with title, subtitle, optional right slot, children.

---

## 8. Map / photo-related code

- **Maps:** No map library or map component. No lat/lng, geocode, or places in schema or UI.
- **Photos:** Trip dashboard only: one static card “Photos” with “0 photos” and two empty `aspect-square` divs. Trip cover and participant avatars use Supabase storage (signed URLs). Note images are stored in `trip-notes` bucket and rendered inside note content (path + bucket). No dedicated “trip photos” gallery or upload flow.

---

## 9. Main state / data-fetching approach

- **Auth:** `useSession()` (Supabase `getSession` + listener); redirect unauthenticated to `/`.
- **Data:** Local `useState` + `useEffect` per page or section. Each screen fetches what it needs (e.g. trip by id, then participants, cover signed URL). Summary cards on trip dashboard each call Supabase in their own `useEffect` by `tripId`.
- **No** server components for data; no React Query/SWR. Refetch is done by re-running the same fetch (e.g. after create/update) or by callback (e.g. `onSuccess` → parent refetch). Budget uses helper modules (`budget-queries.ts`, `budget-money.ts`) for FX and DB calls.

---

## 10. Top 5 UX/UI issues (trip dashboard implementation)

1. **Photos is a placeholder** – “Photos” card shows “0 photos” and static gray boxes with no link, upload, or data; no route or backend for trip photos.
2. **Duplicate fetches and no shared cache** – Trip dashboard and each summary card fetch independently; navigating trip → sub-page refetches trip/participants again. No shared trip context or cache, so extra round-trips and risk of brief inconsistency.
3. **Inconsistent back navigation** – Trip page hero “back” goes to `/dashboard`. Notes/Packing/Budget sub-pages’ back goes to `/dashboard/trip/[id]`. No breadcrumbs or clear hierarchy.
4. **Hardcoded design values** – Colors and spacing repeated across many files (e.g. `#E07A5F`, `#4A4A4A`, `rounded-[24px]`). No design tokens or shared theme; changes require many edits and dark mode in globals is unused in components.
5. **Loading and error handling** – Many screens show a single “Loading…” or generic error. No skeleton loaders, no per-card loading/error states on the trip dashboard, and delete/share errors are mostly alert or inline text with no toast or consistent pattern.
