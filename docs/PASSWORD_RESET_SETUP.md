# Password Reset — Supabase Setup

The forgot-password flow (`/forgot-password` → `/reset-password`) needs three things
configured in the Supabase dashboard. None of them can be committed as code.

**Until step 2 is done, the flow will not work end to end** — Supabase silently refuses to
redirect to a URL that isn't allowlisted.

## 1. SMTP → Resend

`Authentication → Emails → SMTP Settings` → enable custom SMTP:

| Field | Value |
|---|---|
| Host | `smtp.resend.com` |
| Port | `465` |
| Username | `resend` |
| Password | the value of `RESEND_API_KEY` |
| Sender email | the value of `RESEND_FROM` |
| Sender name | `Away We Go` |

Without this, reset emails come from a `supabase.co` address and are rate limited to a
couple per hour on the free tier — usable for local testing, not for real users.

The sender domain must already be verified in Resend. It is, since trip invitation emails
go out through the same account (`app/api/trip-invitations/route.ts`).

## 2. Redirect URL allowlist

`Authentication → URL Configuration → Redirect URLs` — add one entry per origin the app
runs on:

```
http://localhost:3000/reset-password
https://<production-domain>/reset-password
```

The app builds `redirectTo` from `window.location.origin`, so no environment variable
needs to change per deployment — but each origin must appear here. Vercel preview
deployments need their own entry (or a wildcard) if you want to test reset links there.

## 3. Email template

`Authentication → Emails → Templates → Reset Password`. Keep `{{ .ConfirmationURL }}` as
the link target. Match the styling of `components/emails/trip-invitation-email.tsx` so
reset mail looks like the rest of the product.

## Environment variables

None are added by this feature. The commented `NEXT_PUBLIC_APP_URL` in `.env.example` is
unrelated and stays as-is — the reset flow does not read it.

## How the flow works

1. `/forgot-password` calls `resetPasswordForEmail(email, { redirectTo: origin + "/reset-password" })`.
   It always shows the same confirmation, whether or not the address has an account — this
   is what prevents email enumeration, and Supabase returns success either way.
2. Supabase emails a link to `{SUPABASE_URL}/auth/v1/verify?type=recovery&redirect_to=…`.
3. Following it lands on `/reset-password#access_token=…&type=recovery`. The client uses the
   implicit flow with `detectSessionInUrl`, so supabase-js consumes that hash, establishes a
   session, and clears the hash.
4. `/reset-password` requires **both** a session and `wasRecoveryCallback()` before showing the
   form. The second condition is what stops an already signed-in user from changing their
   password here without supplying the current one — that path stays in account settings.
5. On success: `updateUser({ password })`, then `claimPendingTripInvitations`, then `/dashboard`.

## Testing locally

Reset links are single-use and short-lived. Request a fresh one for each attempt; a
second visit to a used link correctly shows the "invalid or expired" state.
