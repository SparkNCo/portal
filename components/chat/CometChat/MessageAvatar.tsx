"use client";

import { cn } from "@/lib/utils";

export function MessageAvatar({
  name,
  className,
}: {
  readonly name: string;
  readonly className?: string;
}) {
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <div
      className={cn(
        "w-7 h-7 rounded-full bg-accent/20 text-accent flex items-center justify-center text-xs font-semibold flex-shrink-0 mt-0.5",
        className,
      )}
    >
      {initials}
    </div>
  );
}
