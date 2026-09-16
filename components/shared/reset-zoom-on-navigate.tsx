"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

// App Router navigations are client-side — the page never actually reloads,
// so a pinch-zoom level the user left on the previous route carries straight
// over to the new one on mobile. Toggling the viewport meta's max-scale
// forces mobile browsers to snap back to 1x, then restoring the original
// content lets the user zoom again on the new route.
export function ResetZoomOnNavigate() {
  const pathname = usePathname();

  useEffect(() => {
    const meta = document.querySelector('meta[name="viewport"]');
    const original = meta?.getAttribute("content");
    if (!meta || !original) return;

    // user-scalable=no (not just maximum-scale=1) and a longer hold before
    // restoring — a shorter toggle is enough in Chromium but iOS Safari
    // needs the stricter constraint held for a beat to actually snap the
    // current pinch level back down, not just cap future zooming.
    meta.setAttribute("content", `${original}, maximum-scale=1, user-scalable=no`);
    const restore = setTimeout(() => meta.setAttribute("content", original), 300);
    return () => clearTimeout(restore);
  }, [pathname]);

  return null;
}
