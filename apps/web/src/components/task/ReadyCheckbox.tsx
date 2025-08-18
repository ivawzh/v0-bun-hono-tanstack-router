import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface ReadyCheckboxProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
  id?: string;
  'aria-label'?: string;
}

export function ReadyCheckbox({
  checked,
  onCheckedChange,
  disabled = false,
  className,
  id,
  'aria-label': ariaLabel,
}: ReadyCheckboxProps) {
  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    // Support Space and Enter keys for keyboard navigation
    if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault();
      onCheckedChange(!checked);
    }
  };

  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={ariaLabel}
      id={id}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      onKeyDown={handleKeyDown}
      className={cn(
        // Base styles - compact 16px circle
        "relative inline-flex items-center justify-center",
        "w-4 h-4 rounded-full border transition-all duration-200",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500",
        "hover:scale-110 active:scale-95",
        // Touch target for mobile (minimum 44px as per guidelines)
        "min-h-[44px] min-w-[44px] touch-manipulation",
        // Ready state (checked) - filled green with checkmark
        checked && [
          "bg-green-600 border-green-600 text-white",
          "hover:bg-green-700 hover:border-green-700"
        ],
        // Not ready state (unchecked) - gray outline
        !checked && [
          "bg-transparent border-gray-400 text-transparent",
          "hover:border-gray-500 hover:bg-gray-50"
        ],
        // Disabled state
        disabled && "opacity-50 cursor-not-allowed hover:scale-100",
        className
      )}
    >
      {/* Checkmark icon - only visible when checked */}
      <Check 
        className={cn(
          "w-2.5 h-2.5 transition-opacity duration-150",
          checked ? "opacity-100" : "opacity-0"
        )} 
      />
    </button>
  );
}