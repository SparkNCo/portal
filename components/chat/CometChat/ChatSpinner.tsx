"use client";

export function ChatSpinner({
  label,
  size = "md",
}: {
  readonly label?: string;
  readonly size?: "sm" | "md";
}) {
  const spinnerClass =
    size === "sm"
      ? "w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin"
      : "w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin";

  return (
    <div className="flex flex-1 items-center justify-center">
      {label ? (
        <div
          className={`flex ${size === "sm" ? "items-center" : "flex-col items-center"} gap-2 text-muted-foreground`}
        >
          <div className={spinnerClass} />
          <span className={size === "sm" ? "text-xs" : "text-sm"}>{label}</span>
        </div>
      ) : (
        <div className={spinnerClass} />
      )}
    </div>
  );
}
