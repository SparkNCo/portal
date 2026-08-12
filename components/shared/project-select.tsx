import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function ProjectSelect({
  projects,
  value,
  onValueChange,
  id,
}: {
  projects: { id: string; name: string }[];
  value: string;
  onValueChange: (value: string) => void;
  id?: string;
}) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger id={id} className="h-8 text-xs md:smalltext">
        <SelectValue
          placeholder={projects.length ? "Select a project…" : "Loading projects…"}
        />
      </SelectTrigger>
      <SelectContent>
        {projects.map((p) => (
          <SelectItem key={p.id} value={p.id} className="focus:text-primary text-xs md:smalltext">
            {p.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
