/**
 * Client-side checks for the email/password auth forms.
 *
 * Why this exists: Supabase's errors for empty or malformed input are written
 * for the API, not for someone looking at a login box. The worst case is an
 * empty email on sign up — supabase-js posts `{ email: "" }`, and GoTrue reads
 * a signup with no email and no phone as an *anonymous* sign-in, so the form
 * shows "Anonymous sign-ins are disabled". Catching these here keeps the
 * message about the field the user actually needs to fix.
 */

/** Matches the minimum enforced by the account settings password tab. */
export const MIN_PASSWORD_LENGTH = 6;

/**
 * Deliberately loose: enough to catch a missing `@` or a stray space, without
 * second-guessing the addresses the server is willing to accept.
 */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateEmail(email: string): string | null {
  const address = email.trim();
  if (!address) return "Please enter your email address.";
  if (!EMAIL_PATTERN.test(address)) {
    return "Please enter a valid email address, like name@example.com.";
  }
  return null;
}

/** Returns the message to show, or `null` when the form is good to submit. */
export function validateSignUpInput(
  email: string,
  password: string
): string | null {
  const emailError = validateEmail(email);
  if (emailError) return emailError;
  if (!password) return "Please enter a password.";
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Minimum ${MIN_PASSWORD_LENGTH} characters for password.`;
  }
  return null;
}

/**
 * Returns the message to show, or `null` when the form is good to submit.
 *
 * No length check here: an existing account may predate the current policy, so
 * the length of a password that already works is the server's call.
 */
export function validateSignInInput(
  email: string,
  password: string
): string | null {
  const emailError = validateEmail(email);
  if (emailError) return emailError;
  if (!password) return "Please enter your password.";
  return null;
}
