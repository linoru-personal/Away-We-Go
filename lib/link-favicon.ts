/**
 * Returns the domain (hostname) of a URL for use with favicon services.
 */
export function getDomainFromUrl(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

const FAVICON_BASE = "https://www.google.com/s2/favicons";

/**
 * Returns a Google favicon URL for the given link URL.
 * @param url - Full link URL (e.g. https://www.google.com/maps/...)
 * @param size - Preferred size (default 64)
 */
export function getFaviconUrl(url: string, size: number = 64): string {
  const domain = getDomainFromUrl(url);
  if (!domain) return "";
  return `${FAVICON_BASE}?domain=${encodeURIComponent(domain)}&sz=${size}`;
}
