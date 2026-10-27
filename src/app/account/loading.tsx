export default function AccountLoading() {
  return (
    <main className="min-h-screen bg-[#f4f4f4] text-[#171a20]">
      <div className="h-14 bg-[#171a20]" />
      <div className="mx-auto grid max-w-2xl gap-4 px-6 py-10" aria-busy="true" aria-live="polite">
        <p className="text-sm text-[#5c5e62]">Loading your orders…</p>
        <div className="h-10 w-48 rounded bg-white" />
        <div className="h-24 rounded bg-white" />
      </div>
    </main>
  );
}
