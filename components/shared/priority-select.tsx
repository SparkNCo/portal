import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function PrioritySelect({
  value,
  onValueChange,
  id,
}: {
  value: string;
  onValueChange: (value: string) => void;
  id?: string;
}) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger id={id} className="h-8 text-xs md:smalltext">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="low" className="text-xs md:smalltext">Low</SelectItem>
        <SelectItem value="medium" className="text-xs md:smalltext">Medium</SelectItem>
        <SelectItem value="high" className="text-xs md:smalltext">High</SelectItem>
        <SelectItem value="urgent" className="text-xs md:smalltext">Urgent</SelectItem>
      </SelectContent>
    </Select>
  );
}
