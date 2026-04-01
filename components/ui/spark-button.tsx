import { ButtonHTMLAttributes } from "react";

interface SparkButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly variant?: "default" | "inverted" | "primary";
}

export function SparkButton({
  variant = "default",
  className = "",
  children,
  ...props
}: SparkButtonProps) {
  const base = "rounded-lg p-2 disabled:opacity-50 transition-opacity";
  const variants = {
    default: "bg-background text-foreground",
    inverted: "bg-foreground text-background",
    primary: "bg-primary text-background",
  };

  return (
    <button className={`${base} ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
}
