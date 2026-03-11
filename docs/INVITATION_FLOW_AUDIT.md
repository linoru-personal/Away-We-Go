# Trip invitation flow – audit

## 1. What is already implemented

| Area | Status | Details |
|------|--------|---------|
| **trip_invitations table** | ✅ | Table exists with `email`, `email_normalized`, `role`, `status`, `token_hash`, `invited_by`, `created_at`, `expires_at`, etc. RLS: select/insert/update for `can_manage_trip_sharing(trip_id)`. |
| **Share RPC (non-existing user)** | ✅ | `share_trip_with_invitation` branches: existing user → `trip_members` + revoke pending; no user (or owner) → create/update row in `trip_invitations`, return `invitation_token` and `email_send_required: true`. |
| **Invite token** | ✅ | RPC generates token with `gen_random_bytes(32)` (hex), stores SHA-256 hash in `trip_invitations.token_hash`, returns raw token only in RPC response (used once by API to build link and send email). |
| **Route handler / email send** | ✅ | `POST /api/trip-invitations` calls RPC with Bearer token; when `email_send_required && invitation_token` builds accept URL, fetches trip + inviter, renders React email, calls Resend API. |
| **Email provider** | ✅ | Resend: `sendInvitationEmail()` uses `RESEND_API_KEY` and `RESEND_FROM`, POST to `https://api.resend.com/emails`. |
| **Share modal → server** | ✅ | Share modal in `app/dashboard/trip/[id]/page.tsx` calls `fetch("/api/trip-invitations", { method: "POST", headers: { Authorization: Bearer session.access_token }, body: JSON.stringify({ trip_id, email, role }) })`. |
| **/invite page (logged-out)** | ✅ | Renders “Sign in to accept”; Sign in / Sign up link to `/?redirect=/invite?token=...`. |
| **Acceptance RPC** | ✅ | `/invite` when user is logged in calls `accept_trip_invitation(p_token)`; RPC validates token hash, email match, expiry, revoked; inserts `trip_members`, updates invitation `status = 'accepted'`. |

---

## 2. What is missing or broken

| Issue | Impact |
|-------|--------|
| **Resend env in dev** | When `RESEND_API_KEY` or `RESEND_FROM` are unset, the API **silently skips** sending and returns success. Invitation is created and the UI shows “Done.” but **no email is sent**. |
| **Redirect after login/signup** | Home page (`app/page.tsx`) never reads `?redirect=...`. After sign-in or sign-up it always does `router.push("/dashboard")`, so the invite token is lost and the user never returns to `/invite?token=...` to accept. |
| **NEXT_PUBLIC_APP_URL** | If unset, accept link falls back to `VERCEL_URL` (works on Vercel). For local dev, link may be wrong unless `NEXT_PUBLIC_APP_URL=http://localhost:3000` is set. |

---

## 3. Exact reason a non-registered email does not receive an invite

**The email is never sent because Resend is not configured in the environment.**

- In `app/api/trip-invitations/route.ts`, `sendInvitationEmail()` reads `process.env.RESEND_API_KEY` and `process.env.RESEND_FROM`.
- When either is missing, the code does:
  - **Development:** `return { ok: true }` (no Resend call, no error).
  - **Production:** `return { ok: false, error: "Email not configured." }`.
- So in development, the API reports success, the share modal shows “Done.”, and the invitation row is created with a valid token, but **no request is made to Resend** and no email is delivered. The recipient has no way to receive the invite link.

---

## 4. Smallest set of changes to make the flow work end-to-end

1. **Configure Resend (required for email)**  
   In `.env.local` (and in production env):
   - `RESEND_API_KEY` – from [Resend](https://resend.com) (e.g. API Keys).
   - `RESEND_FROM` – verified sender, e.g. `Away We Go <onboarding@resend.dev>` or your domain.

2. **Make missing Resend config visible in dev**  
   In the API route, in development **do not** return success when Resend is unset; return an error (e.g. 502) with a clear message so the UI shows “Email not configured” and the user knows to set the env vars.

3. **Honor redirect on the home page**  
   On `/`:
   - Read `redirect` from the query string (e.g. `useSearchParams().get("redirect")`).
   - When a session already exists, redirect to `redirect` if present and safe (same origin/path), otherwise `/dashboard`.
   - After successful login or signup, redirect to `redirect` if present and safe, otherwise `/dashboard`.
   - This preserves `/invite?token=...` through sign-in/sign-up.

4. **Optional: local accept link**  
   For local dev, set `NEXT_PUBLIC_APP_URL=http://localhost:3000` so the link in the email points to your dev server.

---

## 5. Obvious bugs / integration gaps

| Bug / gap | Location | Fix |
|-----------|----------|-----|
| Silent skip of email in dev | `app/api/trip-invitations/route.ts` → `sendInvitationEmail` | In dev, return `{ ok: false, error: "..." }` when API key or from is missing so the route returns 502 and the modal shows the error. |
| Redirect param ignored | `app/page.tsx` → `handleLogin`, `handleSignup`, initial session redirect | Use `useSearchParams().get("redirect")`; after auth (and when already logged in) redirect to that path if it’s a relative path starting with `/` (e.g. `/invite?token=...`). |
| No .env.example for Resend | Project root | Add `RESEND_API_KEY=` and `RESEND_FROM=` to `.env.example` (or README) so new devs know what to set. |

No other disconnections found: share modal → API → RPC → trip_invitations and token generation are wired; invite page and accept RPC are wired; only email delivery (env) and post-login redirect (home page) were missing.
