import type { ReactNode } from "react";
import { AppLogo } from "@/components/brand/app-logo";

type AuthShellProps = {
  /** Sub-heading under the logo. */
  subtitle?: ReactNode;
  /** Visually hidden page heading, for screen readers. */
  srHeading: string;
  /** Small print under the card. */
  footer?: ReactNode;
  children: ReactNode;
};

/**
 * Page chrome shared by every auth screen: warm background, centered logo,
 * rounded white card. Used by login, forgot password, and reset password.
 */
export function AuthShell({
  subtitle,
  srHeading,
  footer,
  children,
}: AuthShellProps) {
  return (
    <main className="min-h-screen flex items-center justify-center bg-[#fbf7f2] p-6">
      <div className="w-full max-w-[420px]">
        <div className="mb-8 flex flex-col items-center px-2 bg-transparent">
          <AppLogo variant="login" priority className="mx-auto bg-transparent" />
          {subtitle && (
            <p className="mt-4 text-center text-[15px] leading-relaxed text-[#6b6b6b]">
              {subtitle}
            </p>
          )}
        </div>

        <div className="rounded-[28px] border border-[#ebe5df] bg-white p-7 shadow-[0_10px_30px_rgba(0,0,0,0.06)]">
          <h1 className="sr-only">{srHeading}</h1>
          {children}
          {footer && (
            <p className="mt-6 text-center text-xs text-[#8a8a8a]">{footer}</p>
          )}
        </div>
      </div>
    </main>
  );
}
