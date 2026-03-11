/**
 * Trip invitation email template. Inline styles only for email client compatibility.
 *
 * Usage (e.g. in API route with React DOM server):
 *   import { renderToStaticMarkup } from "react-dom/server";
 *   import { TripInvitationEmail } from "@/components/emails/trip-invitation-email";
 *   const html = renderToStaticMarkup(
 *     <TripInvitationEmail
 *       inviterName="Jane"
 *       inviterEmail="jane@example.com"
 *       recipientEmail="friend@example.com"
 *       tripName="Summer in Iceland"
 *       destinationLabel="Reykjavik"
 *       tripDateLabel="Jun 10 – 17, 2025"
 *       role="editor"
 *       acceptUrl="https://app.example.com/invite?token=..."
 *       coverImageUrl="https://..."
 *     />
 *   );
 *   await resend.emails.send({ from, to, subject, html });
 */

export type TripInvitationEmailProps = {
  inviterName: string;
  inviterEmail: string;
  recipientEmail: string;
  tripName: string;
  destinationLabel?: string;
  tripDateLabel?: string;
  role: "admin" | "editor" | "viewer";
  acceptUrl: string;
  coverImageUrl?: string | null;
};

const ROLE_LABELS: Record<TripInvitationEmailProps["role"], string> = {
  admin: "Admin",
  editor: "Editor",
  viewer: "Viewer",
};

const ROLE_DESCRIPTIONS: Record<TripInvitationEmailProps["role"], string> = {
  admin: "Can manage sharing, edit trip details, and edit all content.",
  editor: "Can add and edit trip content (tasks, notes, packing, places, photos).",
  viewer: "Read-only access to view the trip and all content.",
};

function getRoleDescription(role: TripInvitationEmailProps["role"]): string {
  return ROLE_DESCRIPTIONS[role];
}

const styles = {
  wrapper: {
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
    fontSize: 16,
    lineHeight: 1.5,
    color: "#1f1f1f",
    backgroundColor: "#f5f3f0",
    margin: 0,
    padding: "24px 16px",
  },
  container: {
    maxWidth: 560,
    margin: "0 auto",
    backgroundColor: "#ffffff",
    borderRadius: 16,
    overflow: "hidden",
    boxShadow: "0 4px 24px rgba(0,0,0,0.08)",
  },
  hero: {
    width: "100%",
    height: 220,
    objectFit: "cover" as const,
    display: "block" as const,
    backgroundColor: "#e0d9d2",
  },
  heroOverlay: {
    background: "linear-gradient(to top, rgba(0,0,0,0.65) 0%, rgba(0,0,0,0.2) 50%, transparent 100%)",
    padding: "120px 24px 24px",
    marginTop: -220,
    marginBottom: 0,
  },
  heroTitle: {
    margin: 0,
    fontSize: 24,
    fontWeight: 700,
    color: "#ffffff",
    textShadow: "0 1px 2px rgba(0,0,0,0.5)",
    letterSpacing: "-0.02em",
  },
  heroSubtitle: {
    margin: "6px 0 0",
    fontSize: 14,
    color: "rgba(255,255,255,0.95)",
  },
  section: {
    padding: "24px 24px 16px",
  },
  heading: {
    margin: "0 0 8px",
    fontSize: 20,
    fontWeight: 600,
    color: "#1f1f1f",
  },
  bodyText: {
    margin: "0 0 16px",
    fontSize: 15,
    color: "#4a4a4a",
    lineHeight: 1.5,
  },
  roleCard: {
    margin: "20px 0 24px",
    padding: "16px 18px",
    backgroundColor: "#f6f2ed",
    borderRadius: 12,
    borderLeft: "4px solid #d97b5e",
  },
  roleLabel: {
    margin: "0 0 4px",
    fontSize: 13,
    fontWeight: 600,
    color: "#b85a42",
    textTransform: "uppercase" as const,
    letterSpacing: "0.04em",
  },
  roleDescription: {
    margin: 0,
    fontSize: 14,
    color: "#4a4a4a",
    lineHeight: 1.45,
  },
  ctaWrapper: {
    margin: "28px 0 16px",
    textAlign: "center" as const,
  },
  ctaButton: {
    display: "inline-block",
    padding: "14px 32px",
    backgroundColor: "#d97b5e",
    color: "#ffffff",
    fontSize: 16,
    fontWeight: 600,
    textDecoration: "none",
    borderRadius: 9999,
    boxShadow: "0 2px 8px rgba(217,123,94,0.35)",
  },
  fallbackLink: {
    display: "block",
    marginTop: 16,
    fontSize: 13,
    color: "#6b6b6b",
    wordBreak: "break-all" as const,
  },
  link: {
    color: "#d97b5e",
    textDecoration: "underline",
  },
  listSection: {
    marginTop: 28,
    paddingTop: 20,
    borderTop: "1px solid #ebe5df",
  },
  listTitle: {
    margin: "0 0 12px",
    fontSize: 14,
    fontWeight: 600,
    color: "#4a4a4a",
  },
  list: {
    margin: 0,
    paddingLeft: 20,
    fontSize: 14,
    color: "#4a4a4a",
    lineHeight: 1.6,
  },
  listItem: {
    marginBottom: 6,
  },
  footer: {
    padding: "20px 24px 28px",
    backgroundColor: "#fafaf8",
    borderTop: "1px solid #ebe5df",
    fontSize: 12,
    color: "#8a8a8a",
    lineHeight: 1.5,
  },
  footerRow: {
    margin: "4px 0",
  },
  footerSafety: {
    margin: "16px 0 0",
    paddingTop: 12,
    borderTop: "1px solid #e8e4e0",
    fontStyle: "italic" as const,
  },
} as const;

const BULLET_POINTS: string[] = [
  "View trip details, dates, and destination",
  "See and use tasks, notes, packing lists, and photos",
  "Collaborate with the trip owner and other members",
  "Access everything from the web app on any device",
];

export function getRoleDescriptionForEmail(role: TripInvitationEmailProps["role"]): string {
  return getRoleDescription(role);
}

export function TripInvitationEmail({
  inviterName,
  inviterEmail,
  recipientEmail,
  tripName,
  destinationLabel,
  tripDateLabel,
  role,
  acceptUrl,
  coverImageUrl,
}: TripInvitationEmailProps) {
  const roleLabel = ROLE_LABELS[role];
  const roleDescription = getRoleDescription(role);
  const subtitleParts: string[] = [];
  if (destinationLabel?.trim()) subtitleParts.push(destinationLabel.trim());
  if (tripDateLabel?.trim()) subtitleParts.push(tripDateLabel.trim());
  const heroSubtitle = subtitleParts.join(" · ") || tripName;

  return (
    <div style={styles.wrapper}>
      <div style={styles.container}>
        {/* Hero: cover image then overlay (negative margin). No position:absolute for email client support. */}
        {coverImageUrl ? (
          <>
            <img
              src={coverImageUrl}
              alt=""
              width={560}
              height={220}
              style={styles.hero}
            />
            <div style={styles.heroOverlay}>
              <h1 style={styles.heroTitle}>{tripName}</h1>
              <p style={styles.heroSubtitle}>{heroSubtitle}</p>
            </div>
          </>
        ) : (
          <div style={{ padding: "24px 24px 20px", backgroundColor: "#e0d9d2" }}>
            <h1 style={{ ...styles.heroTitle, color: "#2d2d2d", margin: 0 }}>{tripName}</h1>
            <p style={{ ...styles.heroSubtitle, color: "#5a5a5a", margin: "6px 0 0" }}>{heroSubtitle}</p>
          </div>
        )}

        <div style={styles.section}>
          <h2 style={styles.heading}>You&apos;re invited!</h2>
          <p style={styles.bodyText}>
            <strong>{inviterName}</strong>
            {destinationLabel?.trim() ? ` has invited you to the trip "${tripName}".` : ` has invited you to join "${tripName}".`}
          </p>

          <div style={styles.roleCard}>
            <p style={styles.roleLabel}>{roleLabel}</p>
            <p style={styles.roleDescription}>{roleDescription}</p>
          </div>

          <div style={styles.ctaWrapper}>
            <a href={acceptUrl} style={styles.ctaButton}>
              Accept invitation
            </a>
            <p style={styles.fallbackLink}>
              If the button doesn&apos;t work, copy and paste this link into your browser:
              <br />
              <a href={acceptUrl} style={styles.link}>
                {acceptUrl}
              </a>
            </p>
          </div>

          <div style={styles.listSection}>
            <p style={styles.listTitle}>What you can do:</p>
            <ul style={styles.list}>
              {BULLET_POINTS.map((text, i) => (
                <li key={i} style={styles.listItem}>
                  {text}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div style={styles.footer}>
          <p style={styles.footerRow}>From: {inviterEmail}</p>
          <p style={styles.footerRow}>To: {recipientEmail}</p>
          <p style={styles.footerSafety}>
            If you weren&apos;t expecting this invitation, you can safely ignore this email.
          </p>
        </div>
      </div>
    </div>
  );
}
