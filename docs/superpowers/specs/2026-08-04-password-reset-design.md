# Password Reset (Forgot Password) — Design

**Date:** 2026-08-04
**Status:** Approved, ready for implementation planning

## Problem

Users who forget their password have no way back into the app. `app/home-page-content.tsx`
offers only Login and Sign Up; there is no `resetPasswordForEmail` call, no recovery route,
and no "Forgot password?" link anywhere in the UI.

Changing a password while signed in already works — `components/account/account-settings-modal.tsx`
has a Password tab that re-authenticates and calls `updateUser`. **That tab is out of scope
here and is not modified.**

## Scope

**In:** the forgot-password reset flow — request a reset by email, receive a recovery link,
set a new password, land in the app signed in.

**Out:** any change to the existing change-password tab; revoking the user's other sessions
after a reset; password strength meters; captcha; adding a test framework.

## Decisions

| Decision | Choice | Reasoning |
|---|---|---|
| Email delivery | `supabase.auth.resetPasswordForEmail()`, Supabase SMTP pointed at Resend | No sending code, no token table, no security surface we own — but mail comes from our domain rather than a `supabase.co` address |
| After successful reset | Straight to `/dashboard`, signed in | The recovery link already established a valid session; matches how signup behaves today |
| Request form location | Dedicated `/forgot-password` route | Keeps `home-page-content.tsx` from taking on another mode + state machine on top of login, signup, redirect, and invite-claim logic |
| Email enumeration | Neutral response always | Effectively forced: Supabase returns success for unknown addresses |
| Password rules | Min 6 chars, must match confirmation | Consistent with the existing change-password tab (`account-settings-modal.tsx:153-159`) |
| Recovery gate | Require a recovery callback, not merely a session | Otherwise an already-signed-in user could change their password without the current one, bypassing the settings modal's re-auth |
| Verification | `npm run build` + `npm run lint` + manual checklist | Repo has no test runner; a framework may be added in later work |

## Verified technical constraints

These were confirmed against `node_modules/@supabase/auth-js` (v2.95.x) rather than assumed,
because the whole recovery-landing design depends on them:

1. **`flowType: 'implicit'`** is the client default and the project does not override it
   (`app/lib/supabaseClient.ts` passes no auth options). The recovery link therefore lands as a
   URL **hash fragment** — `#access_token=...&type=recovery` — not a `?code=` query param.
   No `exchangeCodeForSession` call is needed.
2. **`detectSessionInUrl: true`** is the default, so supabase-js consumes that hash during client
   initialization, saves the session, fires `PASSWORD_RECOVERY`, and clears the hash from the URL.
3. **`getSession()` begins with `await this.initializePromise`.** This is the key guarantee: a
   single awaited `getSession()` on mount resolves *after* the recovery hash has been consumed.
   There is no race between client init and React mount, so the landing page needs **no**
   `onAuthStateChange` subscription and **no** timeout heuristic.

Consequence for implementation: presence of a session after one awaited `getSession()` is the
sole, sufficient signal that the recovery link was valid.

4. **`detectSessionInUrl` also accepts a function** — `(url: URL, params: Record<string, string>) => boolean`
   — called during initialization with the parsed hash params. This is the hook used to
   distinguish a recovery session from an ordinary one (see "Recovery vs. ordinary session" below).

## Recovery vs. ordinary session

A plain "session present" check has a flaw worth naming: **a user who is already signed in and
navigates to `/reset-password` would pass the gate**, letting them set a new password without
entering the current one. That bypasses the re-authentication requirement the app deliberately
implements in the change-password tab (`account-settings-modal.tsx:167-175`).

The `PASSWORD_RECOVERY` event cannot be used to close this, because supabase-js fires it via
`setTimeout(…, 0)` during initialization — it may fire before React mounts and subscribes.
Reading the hash on mount is equally unreliable, since supabase-js clears it during init.

**Mitigation:** pass `detectSessionInUrl` as a function in `app/lib/supabaseClient.ts`. It records
whether the callback was a recovery callback into a module-scoped flag, then returns the default
predicate so existing behavior is unchanged:

```ts
// app/lib/supabaseClient.ts
let recoveryCallback = false;
export const wasRecoveryCallback = () => recoveryCallback;

// inside createClient(...) options:
auth: {
  detectSessionInUrl: (url, params) => {
    if (params.type === "recovery") recoveryCallback = true;
    return Boolean(params.access_token || params.error_description);
  },
},
```

`/reset-password` then requires **both** a session and `wasRecoveryCallback()`. Because the
predicate runs inside `_initialize` and `getSession()` awaits `initializePromise`, the flag is
guaranteed to be set before the gate reads it — no race.

An already-signed-in user visiting `/reset-password` directly therefore gets the `invalid` state
and is pointed at `/forgot-password`, preserving the current-password requirement as the only way
to change a password from inside the app.

This is the one change to shared auth configuration. It is additive: the returned predicate is
byte-for-byte the library default, so login, signup, and invite flows are unaffected.

## Architecture

```
app/
  forgot-password/
    page.tsx                      thin wrapper
    forgot-password-content.tsx   email form -> resetPasswordForEmail()
  reset-password/
    page.tsx                      thin wrapper
    reset-password-content.tsx    session gate -> new password -> updateUser()
  home-page-content.tsx           + "Forgot password?" link under the password field
  lib/supabaseClient.ts           + detectSessionInUrl predicate, wasRecoveryCallback()

components/auth/
  auth-shell.tsx                  page background + logo + card chrome
  auth-form-styles.ts             INPUT_CLASS, LABEL_CLASS, PRIMARY_BUTTON_CLASS
```

The "Forgot password?" link is a plain `<Link href="/forgot-password">` — it does **not** carry the
typed email across as a query parameter. That keeps both new pages free of `useSearchParams` (and
the `Suspense` boundary it would require, as seen in `app/page.tsx`), and keeps email addresses out
of URLs and browser history. The user retypes their address on the request screen.

Both new routes are client components. Auth in this app is entirely client-side — plain
`supabase-js` singleton, no `@supabase/ssr`, no middleware — so a hash-fragment recovery token
can only be read in the browser.

**No API route, no database migration, no token table.** Supabase's `/recover` endpoint sends
the mail.

### Shared shell extraction

`home-page-content.tsx` inlines a ~200-character Tailwind input class twice and the card chrome
once. With three auth screens that duplication will drift, so the shell and the class constants
are extracted to `components/auth/` and adopted by all three screens. Adopting them on the login
page is a mechanical swap with no behavior change.

`account-settings-modal.tsx` has its own near-identical `INPUT_CLASS`. It is deliberately left
alone — that file is out of scope.

## Data flow

```
/ (login) --"Forgot password?"--> /forgot-password
   |
   |  resetPasswordForEmail(email, {
   |    redirectTo: `${window.location.origin}/reset-password`
   |  })
   v
neutral confirmation screen ("If an account exists for X, we sent a link")
   |
   |  email link -> {SUPABASE_URL}/auth/v1/verify?type=recovery&redirect_to=...
   v
/reset-password#access_token=...&type=recovery
   |
   |  supabase-js consumes hash, saves session, clears hash
   v
await getSession()
   |
   +-- session present --> new-password form --> updateUser({ password })
   |                                                |
   |                                                v
   |                          claimPendingTripInvitations(supabase, { force: true })
   |                                                |
   |                                                v
   |                                          router.push("/dashboard")
   |
   \-- no session ------> "link invalid or expired" + link to /forgot-password
```

`redirectTo` is built from `window.location.origin`, not `NEXT_PUBLIC_APP_URL`, so localhost,
preview deploys, and production all work with no per-environment configuration. The trade-off is
that every origin must appear in Supabase's Redirect URLs allowlist.

`claimPendingTripInvitations` is called after a successful reset to mirror login and signup
(`home-page-content.tsx:64,78`) — a user resetting their password may have arrived from a trip
invite.

## Component behavior

### `forgot-password-content.tsx`

Two states: `form` and `sent`.

- Submitting always advances to `sent`, whether or not the address exists. This is what prevents
  email enumeration.
- `sent` displays the address entered, a "Back to sign in" link, and a resend button with a 60s
  client-side cooldown.
- Supabase's own rate limiter returns *"For security purposes, you can only request this after N
  seconds"*. That message is surfaced verbatim rather than swallowed, so the user learns the
  actual retry window.

### `reset-password-content.tsx`

Three states:

| State | Trigger | UI |
|---|---|---|
| `checking` | initial mount, awaiting `getSession()` | spinner matching the login button's existing spinner |
| `ready` | session present **and** `wasRecoveryCallback()` | new password + confirm, show/hide toggle, submit |
| `invalid` | either condition fails once `getSession()` resolves | "This link is invalid or has expired" + button to `/forgot-password` |

Validation: minimum 6 characters, confirmation must match — same rules as the existing
change-password tab.

As a **best-effort** copy refinement only, if `#error_description` happens to still be readable on
the hash it is used to sharpen the `invalid` message. The state machine never depends on it, since
supabase-js may have already cleared the hash.

## Error handling

| Failure | Handling |
|---|---|
| Unknown email | Neutral success screen. No signal to the caller. |
| Rate limited | Show Supabase's message including its retry-after wording. |
| Expired or already-used link | `invalid` state, route back to `/forgot-password`. |
| Already-signed-in user visits `/reset-password` directly | `invalid` state — no recovery callback, so the current-password requirement still stands. |
| New password same as old | Supabase rejects; show the returned message inline. |
| Session expired mid-form | `updateUser` errors; drop to `invalid` state so the user cannot retype into a dead form. |
| Network / offline | Inline error; the form stays filled and re-submittable. |

No password, token, or email value is logged.

## Dashboard configuration

These cannot be committed as code and are documented in `docs/PASSWORD_RESET_SETUP.md`:

1. **Auth → SMTP** — point at Resend using the existing `RESEND_API_KEY`, sender = `RESEND_FROM`.
2. **Auth → URL Configuration → Redirect URLs** — add `http://localhost:3000/reset-password` and
   the production equivalent. The flow silently fails to land correctly without this.
3. **Auth → Email Templates → Reset Password** — brand to match
   `components/emails/trip-invitation-email.tsx`.

No new environment variables. The commented `NEXT_PUBLIC_APP_URL` in `.env.example` stays as-is;
this flow does not use it.

## Verification

The repo has no test runner (no jest, vitest, or playwright in `package.json`), so verification is:

1. `npm run build` — passes with no new type errors.
2. `npm run lint` — passes with no new warnings.
3. Manual checklist, each case confirmed in a browser:
   - Happy path: request reset → receive email → follow link → set password → land on `/dashboard` signed in.
   - New password works on a subsequent fresh login.
   - Unknown email → same neutral confirmation, no error leak.
   - Mismatched confirmation → inline error, no request sent.
   - Password under 6 chars → inline error, no request sent.
   - `/reset-password` opened directly with no token → `invalid` state.
   - `/reset-password` opened directly **while already signed in** → `invalid` state, not the form.
   - Reused link (follow the same link twice) → `invalid` state on the second visit.
   - Login, signup, and the invite-claim flow still work after the `supabaseClient.ts` change.
   - Rapid repeat requests → Supabase rate-limit message shown with its retry window.
   - Login page still renders and logs in correctly after the shell extraction.

A test framework may be introduced in later work; when it is, the password validation rules are
the natural first unit under test.
