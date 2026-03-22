import Image from "next/image";

const LOGO_SRC = "/brand/away-we-go-logo.png";

type AppLogoProps = {
  className?: string;
  /** Larger centered logo on login */
  variant?: "sidebar" | "header" | "login";
  priority?: boolean;
};

/**
 * Full horizontal lockup: paper plane + script “Away We Go” + trail.
 * Asset: `public/brand/away-we-go-logo.png`.
 */
export function AppLogo({
  className = "",
  variant = "sidebar",
  priority = false,
}: AppLogoProps) {
  const sizeClass =
    variant === "login"
      ? "h-[4.5rem] w-auto max-w-[min(100%,440px)] sm:h-[5.25rem] sm:max-w-[min(100%,480px)] object-center mx-auto block"
      : variant === "header"
        ? "h-9 w-auto max-w-[220px] object-left sm:h-10 sm:max-w-[240px]"
        : "h-11 w-auto max-w-[min(100%,280px)] object-left sm:h-[3.25rem] sm:max-w-[min(100%,300px)] md:max-w-[min(100%,320px)]";

  return (
    <Image
      src={LOGO_SRC}
      alt="Away We Go"
      width={565}
      height={164}
      priority={priority}
      className={`bg-transparent object-contain ${sizeClass} ${className}`}
      sizes={
        variant === "login"
          ? "(max-width: 640px) 90vw, 480px"
          : variant === "header"
            ? "240px"
            : "(max-width: 768px) 280px, 300px"
      }
    />
  );
}
