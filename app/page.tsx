import { Suspense } from "react";
import { HomePageContent } from "./home-page-content";

function HomeFallback() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-[#fbf7f2] p-6">
      <div className="w-full max-w-[420px]">
        <div
          className="mx-auto mb-6 flex size-16 items-center justify-center rounded-full bg-white text-[#d97b5e] shadow-[0_10px_30px_rgba(0,0,0,0.06)]"
          aria-hidden
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="size-8"
          >
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
            <circle cx="12" cy="10" r="3" />
          </svg>
        </div>
        <div className="rounded-[28px] border border-[#ebe5df] bg-white p-7 shadow-[0_10px_30px_rgba(0,0,0,0.06)]">
          <p className="text-center text-[#6b6b6b]">Loading…</p>
          <div className="mx-auto mt-4 size-8 animate-spin rounded-full border-2 border-[#d97b5e] border-t-transparent" />
        </div>
      </div>
    </main>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<HomeFallback />}>
      <HomePageContent />
    </Suspense>
  );
}
