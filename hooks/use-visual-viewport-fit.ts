"use client";

import { useEffect, useState, type CSSProperties } from "react";

// Below Tailwind's `sm` — where a centered dialog fills most of the screen.
const MOBILE_QUERY = "(max-width: 639px)";
// Breathing room between the dialog and the visible area's edges.
const MARGIN_PX = 16;

// Keeps a centered dialog inside the part of the screen that's actually
// visible on phones — above the on-screen keyboard. Mobile browsers (iOS
// Safari especially) draw the keyboard over the page instead of shrinking
// it, so a dialog sized to the viewport ends up with its bottom (e.g. a chat
// input) hidden behind the keyboard. `window.visualViewport` is the visible
// part: this returns an inline style that centers the dialog in it and caps
// its height to fit. Empty on wider screens or without visualViewport.
export function useVisualViewportFit(): CSSProperties {
  const [style, setStyle] = useState<CSSProperties>({});

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const mobile = window.matchMedia(MOBILE_QUERY);

    const update = () => {
      if (!mobile.matches) {
        setStyle({});
        return;
      }
      setStyle({
        top: `${viewport.offsetTop + viewport.height / 2}px`,
        maxHeight: `${viewport.height - MARGIN_PX * 2}px`,
      });
    };

    update();
    viewport.addEventListener("resize", update);
    viewport.addEventListener("scroll", update);
    mobile.addEventListener("change", update);
    return () => {
      viewport.removeEventListener("resize", update);
      viewport.removeEventListener("scroll", update);
      mobile.removeEventListener("change", update);
    };
  }, []);

  return style;
}
