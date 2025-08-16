import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Edit3, Check, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface EditableFieldProps {
  type: "input" | "textarea";
  value: string;
  onSave: (newValue: string) => Promise<void>;
  label?: string;
  placeholder?: string;
  maxLength?: number;
  className?: string;
  displayClassName?: string;
  editClassName?: string;
  rows?: number;
  required?: boolean;
  emptyText?: string;
}

export function EditableField({
  type,
  value,
  onSave,
  label,
  placeholder,
  maxLength,
  className,
  displayClassName,
  editClassName,
  rows = 4,
  required = false,
  emptyText = "Click to add content",
}: EditableFieldProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const [isSaving, setIsSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  // Update edit value when prop value changes
  useEffect(() => {
    if (!isEditing) {
      setEditValue(value);
    }
  }, [value, isEditing]);

  // Focus input when entering edit mode
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      // Select all text for easy replacement
      if (type === "input") {
        (inputRef.current as HTMLInputElement).select();
      }
    }
  }, [isEditing, type]);

  const handleStartEdit = () => {
    setEditValue(value);
    setIsEditing(true);
  };

  const handleCancel = () => {
    setEditValue(value);
    setIsEditing(false);
  };

  const handleSave = async () => {
    const trimmedValue = editValue.trim();
    
    // If required and empty, don't save
    if (required && !trimmedValue) {
      return;
    }

    // If value hasn't changed, just exit edit mode
    if (trimmedValue === value) {
      setIsEditing(false);
      return;
    }

    try {
      setIsSaving(true);
      await onSave(trimmedValue);
      setIsEditing(false);
    } catch (error) {
      // Error is handled by the parent component
      console.error("Failed to save:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      handleCancel();
    } else if (e.key === "Enter") {
      if (type === "input" || (type === "textarea" && (e.ctrlKey || e.metaKey))) {
        e.preventDefault();
        handleSave();
      }
    }
  };

  if (isEditing) {
    const InputComponent = type === "input" ? Input : Textarea;
    
    return (
      <div className={cn("space-y-2", className)}>
        {label && <Label className="text-xs text-muted-foreground">{label}</Label>}
        <InputComponent
          ref={inputRef as any}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          maxLength={maxLength}
          rows={type === "textarea" ? rows : undefined}
          className={cn("resize-none", editClassName)}
          disabled={isSaving}
        />
        <div className="flex gap-2">
          <Button 
            size="sm" 
            onClick={handleSave}
            disabled={isSaving || (required && !editValue.trim())}
          >
            {isSaving ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Check className="h-3 w-3" />
            )}
            Save
          </Button>
          <Button 
            size="sm" 
            variant="outline" 
            onClick={handleCancel}
            disabled={isSaving}
          >
            <X className="h-3 w-3" />
            Cancel
          </Button>
        </div>
        {type === "textarea" && (
          <p className="text-xs text-muted-foreground">
            Press Ctrl+Enter to save, Escape to cancel
          </p>
        )}
      </div>
    );
  }

  const displayValue = value || emptyText;
  const isEmpty = !value;

  return (
    <div className={cn("group", className)}>
      {label && <Label className="text-xs text-muted-foreground">{label}</Label>}
      <div 
        className={cn(
          "relative cursor-pointer rounded-md p-3 min-h-[2.5rem] flex items-start",
          "hover:bg-muted/50 transition-colors",
          "border border-transparent hover:border-muted-foreground/20",
          isEmpty && "text-muted-foreground italic",
          displayClassName
        )}
        onClick={handleStartEdit}
      >
        <div className="flex-1 whitespace-pre-wrap break-words">
          {displayValue}
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6 p-0 ml-2 flex-shrink-0"
          onClick={(e) => {
            e.stopPropagation();
            handleStartEdit();
          }}
        >
          <Edit3 className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}