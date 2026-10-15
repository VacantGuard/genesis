export function formatMoney(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

export function formatWhen(iso: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function parseDollarsToCents(raw: string): number | null {
  const value = raw.trim();
  if (!/^\d+(\.\d{1,2})?$/.test(value)) return null;
  const cents = Math.round(Number(value) * 100);
  if (!Number.isFinite(cents) || cents < 0 || cents > 100_000) return null;
  return cents;
}
