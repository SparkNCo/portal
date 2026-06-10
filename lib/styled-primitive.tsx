import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Creates a forwardRef wrapper around a primitive component that merges a
 * default className with a caller-provided one via `cn`.
 */
export function createStyledPrimitive<
  T extends React.ElementType<{ className?: string }>,
>(Component: T, defaultClassName: string) {
  const StyledComponent = React.forwardRef<
    React.ElementRef<T>,
    React.ComponentPropsWithoutRef<T>
  >(({ className, ...props }, ref) => (
    // @ts-expect-error -- ref type depends on the wrapped element type T
    <Component ref={ref} className={cn(defaultClassName, className)} {...props} />
  ));
  StyledComponent.displayName = (Component as { displayName?: string })
    .displayName;
  return StyledComponent;
}
