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
    // future" rather than a guaranteed synchronous effect — a fixed delay
    // before restoring is a guess that happened to work in dev (React
    // Strict Mode double-invokes the effect, giving it an accidental second
    // attempt) but not in production, where it only runs once. Polling the
    // real visualViewport.scale and restoring only once it's actually back
    // down (capped by a timeout so a never-zoomed page doesn't hang) reacts
    // to the true signal instead of guessing how long the browser needs.
    meta.setAttribute("content", `${original}, maximum-scale=1, user-scalable=no`);
    let pollId = 0;
    let cancelled = false;
    const deadline = Date.now() + 1500;
    function poll() {
      if (cancelled) return;
      const scale = window.visualViewport?.scale ?? 1;
      if (scale <= 1.02 || Date.now() > deadline) {
        meta!.setAttribute("content", original!);
        return;
      }
      pollId = requestAnimationFrame(poll);
    }
    pollId = requestAnimationFrame(poll);
    return () => {
      cancelled = true;
      cancelAnimationFrame(pollId);
      meta!.setAttribute("content", original!);
    };
  }, [pathname]);

  return null;
}
