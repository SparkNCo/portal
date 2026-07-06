"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";

export function SortablePinnedPanel({
  id,
  children,
}: Readonly<{ id: string; children: React.ReactNode }>) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="relative">
      <button
        type="button"
        {...attributes}
        {...listeners}
        title="Drag to reorder"
        className="absolute top-3 left-3 z-10 cursor-grab touch-none rounded-md border border-border/40 bg-background/80 p-1.5 text-muted-foreground hover:text-foreground hover:border-foreground/30 active:cursor-grabbing"
      >
        <GripVertical className="h-3.5 w-3.5" />
      </button>
      {children}
    </div>
  );
}
