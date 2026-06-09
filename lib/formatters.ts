export function formatDateFromUnix(seconds?: number): string {
  if (!seconds) return "—";
  return new Date(seconds * 1000).toLocaleDateString("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
  });
}

export function formatAmountFromCents(cents?: number, currency?: string): string {
  if (cents == null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency?.toUpperCase() || "USD",
  }).format(cents / 100);
}
