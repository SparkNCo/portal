"use client";
import { useEffect, useState } from "react";

export function useResponsiveCellSize() {
  const [cellSize, setCellSize] = useState(64);

  useEffect(() => {
    const sm = window.matchMedia("(min-width: 640px)");
    const md = window.matchMedia("(min-width: 768px)");
    const lg = window.matchMedia("(min-width: 1024px)");

    const update = () => {
      if (lg.matches) setCellSize(64);
      else if (md.matches) setCellSize(48);
      else if (sm.matches) setCellSize(40);
      else setCellSize(32);
    };

    update();

    sm.addEventListener("change", update);
    md.addEventListener("change", update);
    lg.addEventListener("change", update);

    return () => {
      sm.removeEventListener("change", update);
      md.removeEventListener("change", update);
      lg.removeEventListener("change", update);
    };
  }, []);

  return cellSize;
}
