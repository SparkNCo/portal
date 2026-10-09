"use client";

// Splits a chat's message list by day: a divider goes above the first
// message of each day, reading "Today" or the date as DD-MM-YY. Shared by
// both chat systems (CometChat and Realtime), which only differ in how a
// message exposes its timestamp — hence the `getDate` callback below.

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function formatDayLabel(date: Date): string {
  if (isSameDay(date, new Date())) return "Today";
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yy = String(date.getFullYear()).slice(-2);
  return `${dd}-${mm}-${yy}`;
}

// For each message, its date if it's the first one of its day (so a divider
// goes above it), otherwise null. Messages with no timestamp yet (e.g. still
// sending) never start a day and don't reset the comparison.
export function markDayStarts<T>(messages: T[], getDate: (msg: T) => Date | null): (Date | null)[] {
  let previous: Date | null = null;
  return messages.map((msg) => {
    const date = getDate(msg);
    if (!date || Number.isNaN(date.getTime())) return null;
    const startsDay = !previous || !isSameDay(date, previous);
    previous = date;
    return startsDay ? date : null;
  });
}

export function DateDivider({ date }: { readonly date: Date }) {
  const label = formatDayLabel(date);
  return (
    <div role="separator" aria-label={label} className="flex items-center gap-3 py-1">
      <div className="h-px flex-1 bg-border" aria-hidden="true" />
      <span className="smalltext text-muted-foreground">{label}</span>
      <div className="h-px flex-1 bg-border" aria-hidden="true" />
    </div>
  );
}
