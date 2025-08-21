import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface TaskModeSelectorProps {
  mode: string | null;
  list: string;
  onModeChange: (mode: string | null) => void;
  disabled?: boolean;
  size?: "sm" | "md";
}

const modes = [
  { value: "clarify", label: "Clarify", color: "bg-purple-100 text-purple-800 border-purple-200" },
  { value: "plan", label: "Plan", color: "bg-pink-100 text-pink-800 border-pink-200" },
  { value: "execute", label: "Execute", color: "bg-blue-100 text-blue-800 border-blue-200" },
  { value: "loop", label: "Loop", color: "bg-orange-100 text-orange-800 border-orange-200" },
  { value: "talk", label: "Talk", color: "bg-green-100 text-green-800 border-green-200" },
];

export function TaskModeSelector({
  mode,
  column,
  onModeChange,
  disabled = false,
  size = "sm"
}: TaskModeSelectorProps) {
  // Don't show mode selector for Done tasks or Todo tasks
  if (column === "done" || column === "todo") {
    return null;
  }

  // For loop tasks, show read-only loop mode badge
  if (column === "loop") {
    const loopMode = modes.find(m => m.value === "loop");
    return (
      <div className={cn(
        "h-6 text-xs px-2 py-1 rounded font-medium border inline-flex items-center",
        loopMode?.color || "bg-orange-100 text-orange-800 border-orange-200"
      )}>
        Loop
      </div>
    );
  }

  const currentMode = modes.find(m => m.value === mode);

  return (
    <Select
      value={mode || ""}
      onValueChange={(value) => onModeChange(value || null)}
      disabled={disabled}
    >
      <SelectTrigger
        className={cn(
          "h-6 text-xs border-0 bg-transparent p-1 font-medium",
          size === "sm" ? "w-auto min-w-[70px]" : "w-auto min-w-[80px]",
          currentMode?.color || "bg-gray-100 text-gray-800"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <SelectValue placeholder="Select mode" />
      </SelectTrigger>
      <SelectContent>
        {modes.map((modeOption) => (
          <SelectItem key={modeOption.value} value={modeOption.value}>
            <span className={cn("px-2 py-1 rounded text-xs", modeOption.color)}>
              {modeOption.label}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
