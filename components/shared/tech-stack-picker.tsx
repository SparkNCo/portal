"use client";

import { useState } from "react";
import { GripVertical, X } from "lucide-react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { badgeVariants } from "@/components/ui/badge";
import { Button } from "@/components/components/ui/button";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

// Same dnd-kit sortable-list pattern as the Steps editor in the issue
// detail modal's Tests tab (components/client/issue-detail-modal.tsx),
// adapted to a wrapping row of pills instead of a stacked list.
function SortableTechChip({
  tech,
  onRemove,
}: {
  tech: string;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: tech });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        badgeVariants({ variant: "secondary" }),
        "gap-1 pr-1 cursor-grab touch-none active:cursor-grabbing",
      )}
    >
      <GripVertical className="h-3 w-3 text-muted-foreground" />
      {tech}
      <button
        type="button"
        onClick={onRemove}
        onPointerDown={(e) => e.stopPropagation()}
        className="rounded-full hover:bg-muted-foreground/20"
        aria-label={`Remove ${tech}`}
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}

function DraggableTechChips({
  techStack,
  onChange,
}: {
  techStack: string[];
  onChange: (techStack: string[]) => void;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = techStack.indexOf(active.id as string);
    const newIndex = techStack.indexOf(over.id as string);
    if (oldIndex === -1 || newIndex === -1) return;
    onChange(arrayMove(techStack, oldIndex, newIndex));
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={techStack} strategy={rectSortingStrategy}>
        <div className="flex flex-wrap gap-1.5">
          {techStack.map((tech) => (
            <SortableTechChip
              key={tech}
              tech={tech}
              onRemove={() => onChange(techStack.filter((t) => t !== tech))}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

// Type-to-add + drag-to-reorder tech stack editor. Used from the admin
// Edit Developer Profile modal and the customer-facing Add Developer modal.
export function TechStackPicker({
  value,
  onChange,
}: {
  value: string[];
  onChange: (value: string[]) => void;
}) {
  const [input, setInput] = useState("");

  const addTech = () => {
    const tech = input.trim();
    if (tech && !value.includes(tech)) {
      onChange([...value, tech]);
    }
    setInput("");
  };

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <Input
            className="bg-secondary border-0"
            placeholder="Type a skill..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === ",") {
                e.preventDefault();
                addTech();
              }
            }}
          />
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-9"
          disabled={!input.trim()}
          onClick={addTech}
        >
          Add
        </Button>
      </div>

      <div className="min-h-[60px] rounded-lg border border-dashed border-border p-2.5">
        {value.length === 0 ? (
          <p className="text-xs text-muted-foreground italic text-center py-2.5">
            Add skills here
          </p>
        ) : (
          <DraggableTechChips techStack={value} onChange={onChange} />
        )}
      </div>
    </div>
  );
}
