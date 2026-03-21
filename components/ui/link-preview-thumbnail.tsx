"use client";

import { Link as LinkIcon } from "lucide-react";
import { useEffect, useState } from "react";

/** Treat Open Graph / preview images smaller than this as favicon noise or broken. */
const MIN_PREVIEW_DIMENSION = 64;

export interface LinkPreviewThumbnailProps {
  /** Resolved preview image URL (e.g. og:image). Null/empty shows fallback only. */
  imageUrl: string | null | undefined;
  /** True while link metadata is still loading (shows subtle pulse on fallback). */
  apiLoading?: boolean;
  /** Outer size of the thumb (default matches note link preview card). */
  className?: string;
}

/**
 * Fixed-size preview thumbnail: shows og:image when it loads and is large enough;
 * otherwise a neutral placeholder with a link icon (no low-quality favicon).
 */
export function LinkPreviewThumbnail({
  imageUrl,
  apiLoading = false,
  className = "h-20 w-20",
}: LinkPreviewThumbnailProps) {
  const [imageReady, setImageReady] = useState(false);
  const url = (imageUrl ?? "").trim();

  useEffect(() => {
    setImageReady(false);
  }, [url]);

  const tryImage = url.length > 0 && !apiLoading;
  const showImage = tryImage && imageReady;

  return (
    <div
      className={`relative shrink-0 overflow-hidden rounded-lg border border-gray-200/90 bg-gray-100 shadow-[0_1px_3px_rgba(0,0,0,0.06)] ${className}`}
    >
      <div
        className={`absolute inset-0 z-0 flex items-center justify-center transition-opacity duration-300 ease-out ${
          showImage ? "pointer-events-none opacity-0" : "opacity-100"
        } ${apiLoading ? "animate-pulse" : ""}`}
        aria-hidden
      >
        <LinkIcon
          className="h-[40%] w-[40%] max-h-8 min-h-3.5 text-gray-400"
          strokeWidth={1.75}
          aria-hidden
        />
      </div>
      {tryImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt=""
          className={`relative z-10 size-full object-cover transition-opacity duration-300 ease-out ${
            showImage ? "opacity-100" : "opacity-0"
          }`}
          onLoad={(e) => {
            const { naturalWidth, naturalHeight } = e.currentTarget;
            if (
              naturalWidth >= MIN_PREVIEW_DIMENSION &&
              naturalHeight >= MIN_PREVIEW_DIMENSION
            ) {
              setImageReady(true);
            }
          }}
          onError={() => setImageReady(false)}
        />
      ) : null}
    </div>
  );
}
