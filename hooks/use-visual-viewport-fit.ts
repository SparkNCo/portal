"use client";

import { useEffect, useState, type CSSProperties } from "react";

// Below Tailwind's `sm`.
const MOBILE_QUERY = "(max-width: 639px)";
// Gap between the dialog and the visible area's edges.
const MARGIN_PX = 16;
// Just over the dialog's height transition (duration-200).
const SETTLE_MS = 250;

// On phones, keeps a centered dialog above the on-screen keyboard: returns a
// style that fits it into the visible area (window.visualViewport). Empty on
// wider screens.
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

  // Once the dialog has resized for the keyboard, scrolls the focused field
  // back into view.
  useEffect(() => {
    if (!style.maxHeight) {
      return;
    }
    const timer = setTimeout(() => {
      const field = document.activeElement;
      if (field instanceof HTMLTextAreaElement || field instanceof HTMLInputElement) {
        field.scrollIntoView({ block: "nearest" });
      }
    }, SETTLE_MS);
    return () => clearTimeout(timer);
  }, [style.maxHeight]);

  return style;
}
