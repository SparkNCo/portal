import { ChevronDown } from "lucide-react";
import { CardHeader, CardTitle } from "@/components/ui/card";

export function CollapsiblePanelHeader({
  icon,
  title,
  expanded,
  onToggle,
}: {
  icon: React.ReactNode;
  title: string;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <CardHeader
      role="button"
      tabIndex={0}
      onClick={onToggle}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onToggle();
      }}
      className="flex flex-row items-center justify-between cursor-pointer select-none"
    >
      <CardTitle className="flex items-center gap-2">
        {icon}
        {title}
      </CardTitle>
      <ChevronDown
        className={`h-4 w-4 text-muted-foreground transition-transform ${
          expanded ? "rotate-180" : ""
        }`}
      />
    </CardHeader>
  );
}
