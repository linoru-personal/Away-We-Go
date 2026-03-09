"use client";

import { useState } from "react";
import { getFaviconUrl } from "@/lib/link-favicon";

function GlobeIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
      <path d="M2 12h20" />
    </svg>
  );
}

export interface LinkFaviconProps {
  url: string;
  /** Size in pixels (e.g. 24 or 28). Default 24. */
  size?: number;
  className?: string;
}

/**
 * Displays a favicon for the link URL with a globe fallback if the image fails to load.
 */
export function LinkFavicon({ url, size = 24, className = "" }: LinkFaviconProps) {
  const [error, setError] = useState(false);
  const faviconUrl = getFaviconUrl(url, size);

  if (!faviconUrl) {
    return (
      <span
        className={`inline-flex shrink-0 items-center justify-center rounded text-[#8a8a8a] ${className}`}
        style={{ width: size, height: size }}
        aria-hidden
      >
        <GlobeIcon className="size-[60%]" />
      </span>
    );
  }

  if (error) {
    return (
      <span
        className={`inline-flex shrink-0 items-center justify-center rounded bg-[#F5F3F0] text-[#8a8a8a] ${className}`}
        style={{ width: size, height: size }}
        aria-hidden
      >
        <GlobeIcon className="size-[60%]" />
      </span>
    );
  }

  return (
    <img
      src={faviconUrl}
      alt=""
      className={`shrink-0 rounded object-contain ${className}`}
      style={{ width: size, height: size }}
      onError={() => setError(true)}
      aria-hidden
    />
  );
}
