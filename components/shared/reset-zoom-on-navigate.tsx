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

    // user-scalable=no (not just maximum-scale=1) to actually force the
    // current pinch level back down, not just cap future zooming. Browser
    // vendors themselves describe this toggle as a hint applied "in the near
    // future" rather than a guaranteed synchronous effect, so restoring too
    // early loses the race — especially on heavier routes (Bugs, Documents)
    // whose own initial data-fetch/render competes for the main thread right
    // when the toggle needs to be applied. A confirmed paint (double rAF)
    // plus a generous hold afterward gives it much more room to land.
    meta.setAttribute("content", `${original}, maximum-scale=1, user-scalable=no`);
    let restoreTimer = 0;
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        restoreTimer = window.setTimeout(() => {
          meta.setAttribute("content", original);
        }, 500);
      });
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      clearTimeout(restoreTimer);
      meta.setAttribute("content", original);
    };
  }, [pathname]);

  return null;
}
