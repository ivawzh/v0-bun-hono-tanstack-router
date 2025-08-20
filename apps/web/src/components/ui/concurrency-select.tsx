/**
 * Concurrency Select Component
 * Provides an intuitive select dropdown for concurrency limits with "Unlimited" option
 */

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface ConcurrencySelectProps {
  value: number;
  onValueChange: (value: number) => void;
  disabled?: boolean;
  className?: string;
}

// Predefined concurrency options
const CONCURRENCY_OPTIONS = [
  { value: 0, label: "Unlimited" },
  { value: 1, label: "1" },
  { value: 2, label: "2" },
  { value: 3, label: "3" },
  { value: 4, label: "4" },
  { value: 5, label: "5" },
  { value: 10, label: "10" },
];

export function ConcurrencySelect({
  value,
  onValueChange,
  disabled = false,
  className
}: ConcurrencySelectProps) {
  // Convert database value to display string
  const getDisplayValue = (dbValue: number): string => {
    if (dbValue === 0) return "unlimited";
    return dbValue.toString();
  };

  // Convert select value to database number
  const handleValueChange = (selectValue: string) => {
    if (selectValue === "unlimited") {
      onValueChange(0);
    } else {
      onValueChange(parseInt(selectValue, 10));
    }
  };

  return (
    <Select 
      value={getDisplayValue(value)} 
      onValueChange={handleValueChange}
      disabled={disabled}
    >
      <SelectTrigger className={className}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {CONCURRENCY_OPTIONS.map(option => (
          <SelectItem 
            key={option.value} 
            value={option.value === 0 ? "unlimited" : option.value.toString()}
          >
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}