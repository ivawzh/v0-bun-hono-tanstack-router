import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Check, X, Edit, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface InlineEditableNumberProps {
  value: number
  onSave: (value: number) => Promise<void> | void
  min?: number
  max?: number
  label?: string
  className?: string
  disabled?: boolean
}

export function InlineEditableNumber({
  value,
  onSave,
  min = 1,
  max = 10,
  label,
  className,
  disabled = false,
}: InlineEditableNumberProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(value.toString())
  const [isSaving, setIsSaving] = useState(false)

  const handleEdit = () => {
    if (disabled) return
    setIsEditing(true)
    setEditValue(value.toString())
  }

  const handleSave = async () => {
    const numValue = parseInt(editValue, 10)
    
    // Validation
    if (isNaN(numValue) || numValue < min || numValue > max) {
      return
    }

    // No change, just cancel
    if (numValue === value) {
      setIsEditing(false)
      return
    }

    setIsSaving(true)
    try {
      await onSave(numValue)
      setIsEditing(false)
    } catch (error) {
      console.error('Failed to save:', error)
      // Reset to original value on error
      setEditValue(value.toString())
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancel = () => {
    setIsEditing(false)
    setEditValue(value.toString())
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave()
    } else if (e.key === 'Escape') {
      handleCancel()
    }
  }

  if (isEditing) {
    return (
      <div className="flex items-center gap-1">
        {label && <span className="text-xs text-muted-foreground">{label}</span>}
        <Input
          type="number"
          min={min}
          max={max}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          className="h-6 w-16 text-xs px-1"
          autoFocus
          disabled={isSaving}
        />
        <Button
          size="sm"
          onClick={handleSave}
          disabled={isSaving || parseInt(editValue, 10) < min || parseInt(editValue, 10) > max || isNaN(parseInt(editValue, 10))}
          className="h-6 w-6 p-0"
        >
          {isSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={handleCancel}
          disabled={isSaving}
          className="h-6 w-6 p-0"
        >
          <X className="h-3 w-3" />
        </Button>
      </div>
    )
  }

  return (
    <button
      onClick={handleEdit}
      disabled={disabled}
      className={cn(
        'text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer disabled:cursor-not-allowed group flex items-center gap-1',
        className
      )}
    >
      {label && <span>{label}</span>}
      <span className="underline decoration-dotted underline-offset-2">{value}</span>
      <Edit className="h-3 w-3 opacity-0 group-hover:opacity-50 transition-opacity" />
    </button>
  )
}