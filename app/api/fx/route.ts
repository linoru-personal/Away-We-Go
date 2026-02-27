import { NextRequest, NextResponse } from "next/server";

const PROVIDER_URL = "https://api.frankfurter.app/latest";
const CACHE_S_MAXAGE = 3600;
const CACHE_STALE_WHILE_REVALIDATE = 86400;

export type FxResponse = {
  from: string;
  to: string;
  rate: number;
  date: string;
  provider: "frankfurter";
};

function getCacheHeaders(): HeadersInit {
  return {
    "Cache-Control": `s-maxage=${CACHE_S_MAXAGE}, stale-while-revalidate=${CACHE_STALE_WHILE_REVALIDATE}`,
  };
}

export async function GET(request: NextRequest) {
  const from = request.nextUrl.searchParams.get("from")?.trim().toUpperCase();
  const to = request.nextUrl.searchParams.get("to")?.trim().toUpperCase();

  if (!from || !to) {
    return NextResponse.json(
      { error: "Missing query parameters: from and to are required" },
      { status: 400, headers: getCacheHeaders() }
    );
  }

  if (from === to) {
    return NextResponse.json(
      { from, to, rate: 1, date: new Date().toISOString().slice(0, 10), provider: "frankfurter" as const },
      { status: 200, headers: getCacheHeaders() }
    );
  }

  const url = `${PROVIDER_URL}?base=${encodeURIComponent(from)}&symbols=${encodeURIComponent(to)}`;

  try {
    const res = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      const text = await res.text();
      let body: unknown;
      try {
        body = JSON.parse(text);
      } catch {
        body = { message: text || res.statusText };
      }
      const msg = typeof body === "object" && body !== null && "message" in body
        ? String((body as { message: unknown }).message)
        : text || res.statusText;
      if (res.status === 404 || /not found|invalid|unsupported|unknown currency/i.test(msg)) {
        return NextResponse.json(
          { error: `Unsupported currency: ${from} or ${to}. Frankfurter does not support one or both.` },
          { status: 422, headers: getCacheHeaders() }
        );
      }
      return NextResponse.json(
        { error: "Exchange rate provider failed" },
        { status: 502, headers: getCacheHeaders() }
      );
    }

    const data = (await res.json()) as { base?: string; date?: string; rates?: Record<string, number> };
    const rate = data?.rates?.[to];
    if (rate == null || typeof rate !== "number") {
      return NextResponse.json(
        { error: `Unsupported currency: ${from} or ${to}. Frankfurter does not support one or both.` },
        { status: 422, headers: getCacheHeaders() }
      );
    }

    const date = typeof data?.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(data.date)
      ? data.date
      : new Date().toISOString().slice(0, 10);

    const body: FxResponse = {
      from,
      to,
      rate,
      date,
      provider: "frankfurter",
    };
    return NextResponse.json(body, { status: 200, headers: getCacheHeaders() });
  } catch (e) {
    return NextResponse.json(
      { error: "Exchange rate provider failed" },
      { status: 502, headers: getCacheHeaders() }
    );
  }
}
