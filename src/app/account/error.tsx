"use client";

import Link from "next/link";

export default function AccountError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="min-h-screen bg-[#fdeae3] px-6 py-16 text-[#496252]">
      <div className="mx-auto grid max-w-md gap-4">
        <h1 className="font-serif text-4xl tracking-tight">Orders could not be loaded</h1>
        <p className="text-sm leading-6 text-[#5d7568]">
          Your account is signed in, but the paid orders for your phone number did not load. Try again.
        </p>
        <div className="flex flex-wrap gap-4 text-sm">
          <button type="button" onClick={() => reset()} className="font-medium underline">
            Try again
          </button>
          <Link href="/" className="text-[#5d7568] underline">
            Back to the menu
          </Link>
        </div>
      </div>
    </main>
  );
}
