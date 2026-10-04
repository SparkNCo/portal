"use client";

// Timestamps: the newest message shows its time under the bubble; every other
// message only shows it beside the bubble while hovered (the bubble's wrapper
// needs `group`). Both carry the full date and time as a tooltip.

export function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function formatFullDateTime(date: Date): string {
  return date.toLocaleString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Shown next to the bubble on hover; takes no extra height.
export function HoverTime({ date }: { readonly date: Date }) {
  return (
    <time
      dateTime={date.toISOString()}
      title={formatFullDateTime(date)}
      className="shrink-0 self-end pb-1 smalltext text-muted-foreground whitespace-nowrap opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
    >
      {formatTime(date)}
    </time>
  );
}

// Shown under the newest message.
export function LastMessageTime({ date, className = "" }: { readonly date: Date; readonly className?: string }) {
  return (
    <time
      dateTime={date.toISOString()}
      title={formatFullDateTime(date)}
      className={`smalltext text-muted-foreground px-1 ${className}`}
    >
      {formatTime(date)}
    </time>
  );
}
