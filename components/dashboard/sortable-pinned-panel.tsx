"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Maximize2, Minimize2, Pin } from "lucide-react";

const actionButtonClass =
  "rounded-md border border-border/40 bg-background/80 p-1.5 text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors";

export function SortablePinnedPanel({
  id,
  fullWidth,
  onToggleWidth,
  onUnpin,
  children,
}: Readonly<{
  id: string;
  fullWidth: boolean;
  onToggleWidth: () => void;
  onUnpin: () => void;
  children: React.ReactNode;
}>) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative ${fullWidth ? "md:col-span-2" : ""}`}
    >
      {/* Grouped in one toolbar so dragging, resizing and unpinning don't
          end up as separate floating buttons overlapping the panel title. */}
      <div className="absolute top-3 right-3 z-10 flex items-center gap-1.5">
        <button
          type="button"
          {...attributes}
          {...listeners}
          title="Drag to reorder"
          className={`${actionButtonClass} cursor-grab touch-none active:cursor-grabbing`}
        >
          <GripVertical className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={onToggleWidth}
          title={fullWidth ? "Shrink to half width" : "Expand to full width"}
          className={actionButtonClass}
        >
          {fullWidth ? (
            <Minimize2 className="h-3.5 w-3.5" />
          ) : (
            <Maximize2 className="h-3.5 w-3.5" />
          )}
        </button>
        <button
          type="button"
          onClick={onUnpin}
          title="Unpin from Dashboard"
          className={actionButtonClass}
        >
          <Pin className="h-3.5 w-3.5 fill-current" />
        </button>
      </div>
      {children}
    </div>
  );
}
