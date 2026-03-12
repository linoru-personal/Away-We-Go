import { Suspense } from "react";
import { InvitePageContent } from "./invite-page-content";

function InviteFallback() {
  const cardClass =
    "mx-auto w-full max-w-[420px] rounded-[28px] border border-[#ebe5df] bg-white p-7 shadow-[0_10px_30px_rgba(0,0,0,0.06)]";
  return (
    <main className="min-h-screen flex items-center justify-center bg-[#fbf7f2] p-6">
      <div className={cardClass}>
        <p className="text-center text-[#6b6b6b]">Loading…</p>
        <div className="mx-auto mt-4 size-8 animate-spin rounded-full border-2 border-[#d97b5e] border-t-transparent" />
      </div>
    </main>
  );
}

export default function InvitePage() {
  return (
    <Suspense fallback={<InviteFallback />}>
      <InvitePageContent />
    </Suspense>
  );
}
