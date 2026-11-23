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
// wider screens. With `fill`, the dialog takes the whole visible area (edge to
// edge, top to bottom) instead of only being capped by it.
export function useVisualViewportFit({ fill = false }: { fill?: boolean } = {}): CSSProperties {
  const [style, setStyle] = useState<CSSProperties>({});

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const mobile = window.matchMedia(MOBILE_QUERY);
    const margin = fill ? 0 : MARGIN_PX;

    const update = () => {
      if (!mobile.matches) {
        setStyle({});
        return;
      }
      const height = `${viewport.height - margin * 2}px`;
      setStyle({
        top: `${viewport.offsetTop + viewport.height / 2}px`,
        maxHeight: height,
        ...(fill && { height }),
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
  }, [fill]);

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
