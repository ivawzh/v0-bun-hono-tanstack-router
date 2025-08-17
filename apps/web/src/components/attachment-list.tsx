import { AttachmentPreview, type AttachmentMetadata } from './attachment-preview'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'

interface AttachmentListProps {
  attachments: AttachmentMetadata[]
  taskId: string
  onDelete?: (id: string) => void
  showDelete?: boolean
  compact?: boolean
  maxHeight?: string
}

export function AttachmentList({ 
  attachments, 
  taskId,
  onDelete, 
  showDelete = false, 
  compact = false,
  maxHeight = '300px'
}: AttachmentListProps) {
  if (attachments.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p className="text-sm">No attachments</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">
          Attachments ({attachments.length})
        </p>
        <p className="text-xs text-muted-foreground">
          {attachments.reduce((sum, att) => sum + att.size, 0) > 0 && 
            `${(attachments.reduce((sum, att) => sum + att.size, 0) / 1024 / 1024).toFixed(1)}MB total`
          }
        </p>
      </div>
      
      <ScrollArea style={{ maxHeight }} className="rounded-md border">
        <div className={cn('p-3 space-y-2', compact && 'p-2 space-y-1')}>
          {attachments.map((attachment, index) => (
            <div key={attachment.id}>
              <AttachmentPreview
                attachment={attachment}
                taskId={taskId}
                onDelete={onDelete}
                showDelete={showDelete}
                compact={compact}
              />
              {index < attachments.length - 1 && !compact && (
                <Separator className="my-2" />
              )}
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  )
}