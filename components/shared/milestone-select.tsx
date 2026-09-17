import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function MilestoneSelect({
  milestones,
  value,
  onValueChange,
  id,
}: {
  milestones: { id: string; name: string; targetDate: string | null }[];
  value: string;
  onValueChange: (value: string) => void;
  id?: string;
}) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger id={id} className="h-8 text-xs md:smalltext">
        <SelectValue
          placeholder={milestones.length ? "Select a milestone…" : "No milestones for this project"}
        />
      </SelectTrigger>
      <SelectContent>
        {milestones.map((m) => (
          <SelectItem key={m.id} value={m.id} className="text-xs md:smalltext">
            {m.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
