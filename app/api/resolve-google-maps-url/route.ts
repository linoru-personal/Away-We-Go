import { NextRequest, NextResponse } from "next/server";
import { isGoogleMapsShortUrl } from "@/lib/parse-google-maps-url";

const FETCH_TIMEOUT_MS = 12_000;

/** Final URL must look like a normal Google Maps link (SSRF / open-redirect guard). */
function isAllowedResolvedGoogleMapsUrl(url: string): boolean {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return false;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return false;
  const h = u.hostname.toLowerCase();
  if (h === "maps.google.com") return true;
  if (h === "google.com" || h === "www.google.com") {
    return u.pathname.includes("/maps");
  }
  if (h.endsWith(".google.com") && u.pathname.includes("/maps")) return true;
  return false;
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const url =
    body &&
    typeof body === "object" &&
    "url" in body &&
    typeof (body as { url: unknown }).url === "string"
      ? (body as { url: string }).url.trim()
      : "";
  if (!url) {
    return NextResponse.json({ error: "Missing url" }, { status: 400 });
  }
  if (!/^https?:\/\//i.test(url)) {
    return NextResponse.json(
      { error: "URL must use http or https" },
      { status: 400 }
    );
  }
  if (!isGoogleMapsShortUrl(url)) {
    return NextResponse.json(
      { error: "URL is not a supported short Maps link" },
      { status: 400 }
    );
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "User-Agent": "AwayWeGo/1.0 (MapsShortLinkResolver)",
      },
    });
    const resolvedUrl = res.url;
    if (!isAllowedResolvedGoogleMapsUrl(resolvedUrl)) {
      return NextResponse.json(
        { error: "Resolved URL is not a recognized Google Maps link" },
        { status: 422 }
      );
    }
    return NextResponse.json({ resolvedUrl });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    if (message.includes("abort")) {
      return NextResponse.json({ error: "Request timed out" }, { status: 504 });
    }
    return NextResponse.json(
      { error: "Could not resolve short link" },
      { status: 502 }
    );
  } finally {
    clearTimeout(timeout);
  }
}
