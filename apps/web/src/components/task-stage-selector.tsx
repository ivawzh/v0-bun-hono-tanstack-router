import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface TaskStageSelectorProps {
  stage: string | null;
  status: string;
  onStageChange: (stage: string | null) => void;
  disabled?: boolean;
  size?: "sm" | "md";
}

const stages = [
  { value: "refine", label: "Refine", color: "bg-purple-100 text-purple-800 border-purple-200" },
  { value: "kickoff", label: "Kickoff", color: "bg-pink-100 text-pink-800 border-pink-200" },
  { value: "execute", label: "Execute", color: "bg-blue-100 text-blue-800 border-blue-200" },
];

export function TaskStageSelector({ 
  stage, 
  status, 
  onStageChange, 
  disabled = false,
  size = "sm"
}: TaskStageSelectorProps) {
  // Don't show stage selector for Done tasks or Todo tasks
  if (status === "done" || status === "todo") {
    return null;
  }

  const currentStage = stages.find(s => s.value === stage);
  
  return (
    <Select 
      value={stage || ""} 
      onValueChange={(value) => onStageChange(value || null)}
      disabled={disabled}
    >
      <SelectTrigger 
        className={cn(
          "h-6 text-xs border-0 bg-transparent p-1 font-medium",
          size === "sm" ? "w-auto min-w-[70px]" : "w-auto min-w-[80px]",
          currentStage?.color || "bg-gray-100 text-gray-800"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <SelectValue placeholder="No stage" />
      </SelectTrigger>
      <SelectContent>
        {stages.map((stageOption) => (
          <SelectItem key={stageOption.value} value={stageOption.value}>
            <span className={cn("px-2 py-1 rounded text-xs", stageOption.color)}>
              {stageOption.label}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}