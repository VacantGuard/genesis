export default function AccountLoading() {
  return (
    <main className="min-h-screen bg-[#fdeae3] text-[#496252]">
      <div className="h-[4.75rem] border-b border-[#a8c09c]/60" />
      <div className="mx-auto grid max-w-2xl gap-4 px-6 py-10" aria-busy="true" aria-live="polite">
        <p className="text-sm text-[#5d7568]">Loading your orders…</p>
        <div className="h-10 w-48 rounded-2xl bg-white" />
        <div className="h-24 rounded-2xl bg-white" />
      </div>
    </main>
  );
}
