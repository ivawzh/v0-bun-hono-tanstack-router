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
  { value: "iterate", label: "Iterate", color: "bg-yellow-100 text-yellow-800 border-yellow-200" },
  { value: "loop", label: "Loop", color: "bg-orange-100 text-orange-800 border-orange-200" },
  { value: "talk", label: "Talk", color: "bg-green-100 text-green-800 border-green-200" },
];

export function TaskModeSelector({
  mode,
  list,
  onModeChange,
  disabled = false,
  size = "sm"
}: TaskModeSelectorProps) {
  // For Doing, Done, and Check tasks, show read-only mode badges
  if (list === "doing" || list === "done" || list === "check") {
    if (!mode) {
      return null;
    }
    
    const currentMode = modes.find(m => m.value === mode);
    // For check mode, show special "Review" label
    const displayMode = list === "check" && mode === "check" 
      ? { label: "Review", color: "bg-amber-100 text-amber-800 border-amber-200" }
      : currentMode;
      
    if (!displayMode) {
      return null;
    }

    return (
      <div className={cn(
        "h-6 text-xs px-2 py-1 rounded font-medium border inline-flex items-center",
        displayMode.color
      )}>
        {displayMode.label}
      </div>
    );
  }

  // For loop tasks, show read-only loop mode badge
  if (list === "loop") {
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
      onValueChange={(value) => onModeChange(value === "" ? null : value)}
      disabled={disabled}
    >
      <SelectTrigger
        className={cn(
          "font-medium",
          size === "sm" 
            ? "h-6 text-xs border-0 bg-transparent p-1 w-auto min-w-[70px]" 
            : "h-10 text-sm border border-input bg-background px-3 py-2 w-full min-w-[200px] hover:bg-accent hover:text-accent-foreground cursor-pointer",
          size === "sm" && currentMode?.color,
          size === "sm" && !currentMode && "bg-gray-100 text-gray-800"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <SelectValue 
          placeholder={size === "md" ? "Default: clarify" : "Select mode"}
        >
          {mode && currentMode && (
            <span className={cn("px-2 py-1 rounded text-xs font-medium", currentMode.color)}>
              {currentMode.label}
            </span>
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {size === "md" && (
          <>
            <SelectItem value="">
              <span className="px-2 py-1 rounded text-xs text-muted-foreground">
                ✨ Default: clarify
              </span>
            </SelectItem>
            <div className="h-px bg-border my-1" />
          </>
        )}
        {modes.map((modeOption) => (
          <SelectItem key={modeOption.value} value={modeOption.value}>
            <span className={cn("px-2 py-1 rounded text-xs font-medium", modeOption.color)}>
              {modeOption.label}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
