import { NextRequest, NextResponse } from "next/server";

export type LinkPreviewResponse = {
  title: string | null;
  description: string | null;
  image: string | null;
  url: string;
  domain: string;
};

/** Decode HTML entities (e.g. &reg;, &amp;) for safe display. No external deps. */
function decodeHtmlEntities(s: string): string {
  if (!s || typeof s !== "string") return s;
  const named: Record<string, string> = {
    "&amp;": "&",
    "&lt;": "<",
    "&gt;": ">",
    "&quot;": '"',
    "&apos;": "'",
    "&#39;": "'",
    "&reg;": "®",
    "&copy;": "©",
    "&nbsp;": " ",
    "&mdash;": "—",
    "&ndash;": "–",
    "&hellip;": "…",
  };
  let out = s;
  for (const [entity, char] of Object.entries(named)) {
    out = out.split(entity).join(char);
  }
  out = out.replace(/&#(\d+);/g, (_, code) => {
    const n = parseInt(code, 10);
    return n >= 0 && n <= 0x10ffff ? String.fromCodePoint(n) : "";
  });
  out = out.replace(/&#x([0-9a-fA-F]+);/g, (_, code) => {
    const n = parseInt(code, 16);
    return n >= 0 && n <= 0x10ffff ? String.fromCodePoint(n) : "";
  });
  return out;
}

function extractOgContent(html: string, property: string): string | null {
  const escaped = property.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(
    `<meta[^>]*property=["']${escaped}["'][^>]*content=["']([^"']*)["']|` +
      `<meta[^>]*content=["']([^"']*)["'][^>]*property=["']${escaped}["']`,
    "i"
  );
  const m = html.match(re);
  const raw = m ? (m[1] || m[2] || "").trim() : null;
  return raw || null;
}

/** Same pattern as `extractOgContent`, but matches `name="..."` (e.g. Twitter cards). */
function extractMetaNameContent(html: string, name: string): string | null {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(
    `<meta[^>]*name=["']${escaped}["'][^>]*content=["']([^"']*)["']|` +
      `<meta[^>]*content=["']([^"']*)["'][^>]*name=["']${escaped}["']`,
    "i"
  );
  const m = html.match(re);
  const raw = m ? (m[1] || m[2] || "").trim() : null;
  return raw || null;
}

function extractTitle(html: string): string | null {
  const m = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  const raw = m ? m[1].trim() : null;
  return raw || null;
}

export async function GET(request: NextRequest) {
  const urlParam = request.nextUrl.searchParams.get("url");
  if (!urlParam || typeof urlParam !== "string") {
    return NextResponse.json(
      { error: "Missing or invalid url parameter" },
      { status: 400 }
    );
  }
  const trimmed = urlParam.trim();
  if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://")) {
    return NextResponse.json(
      { error: "URL must use http or https" },
      { status: 400 }
    );
  }
  let targetUrl: URL;
  try {
    targetUrl = new URL(trimmed);
  } catch {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  }

  try {
    const res = await fetch(trimmed, {
      method: "GET",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; LinkPreview/1.0; +https://github.com/away-we-go)",
      },
      signal: AbortSignal.timeout(8000),
      redirect: "follow",
    });
    if (!res.ok) {
      return NextResponse.json(
        { error: `Fetch failed: ${res.status}` },
        { status: 502 }
      );
    }
    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.toLowerCase().includes("text/html")) {
      return NextResponse.json(
        { error: "URL did not return HTML" },
        { status: 400 }
      );
    }
    const html = await res.text();
    const ogTitle = extractOgContent(html, "og:title");
    const ogDescription = extractOgContent(html, "og:description");
    const ogImage = extractOgContent(html, "og:image");
    const twitterImageName = extractMetaNameContent(html, "twitter:image");
    const twitterImageProperty = extractOgContent(html, "twitter:image");
    const rawImage = ogImage || twitterImageName || twitterImageProperty;
    const pageTitle = extractTitle(html);
    const rawTitle = ogTitle || pageTitle || null;
    const title = rawTitle ? decodeHtmlEntities(rawTitle) : null;
    const rawDescription = ogDescription || null;
    const description = rawDescription ? decodeHtmlEntities(rawDescription) : null;
    const image = rawImage
      ? rawImage.startsWith("http")
        ? rawImage
        : new URL(rawImage, trimmed).href
      : null;

    const body: LinkPreviewResponse = {
      title,
      description,
      image,
      url: targetUrl.href,
      domain: targetUrl.hostname,
    };
    return NextResponse.json(body);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to fetch URL";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
