import { useState } from 'react'
import { X, Download, Eye, FileText, Image, File, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

export interface AttachmentMetadata {
  id: string
  filename: string
  originalName: string
  path: string
  size: number
  type: string
  uploadedAt: string
}

interface AttachmentPreviewProps {
  attachment: AttachmentMetadata
  onDelete?: (id: string) => void
  showDelete?: boolean
  compact?: boolean
}

function getFileIcon(type: string, className?: string) {
  if (!type) return <File className={className} />
  if (type.startsWith('image/')) return <Image className={className} />
  if (type === 'application/pdf') return <FileText className={className} />
  if (type.startsWith('text/') || type === 'application/json') return <FileText className={className} />
  return <File className={className} />
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

export function AttachmentPreview({ 
  attachment, 
  onDelete, 
  showDelete = true, 
  compact = false 
}: AttachmentPreviewProps) {
  const [showPreview, setShowPreview] = useState(false)
  const [previewError, setPreviewError] = useState(false)

  const handleDownload = () => {
    // Create a download link using the attachment API endpoint
    const downloadUrl = `/api/tasks/${attachment.id}/attachments/${attachment.id}/download`
    const link = document.createElement('a')
    link.href = downloadUrl
    link.download = attachment.originalName
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handlePreview = () => {
    if (attachment.type && attachment.type.startsWith('image/')) {
      setShowPreview(true)
      setPreviewError(false)
    }
  }

  if (compact) {
    return (
      <div className="flex items-center gap-2 p-2 border rounded-md">
        {getFileIcon(attachment.type, 'h-4 w-4 text-muted-foreground')}
        <span className="text-sm truncate flex-1">{attachment.originalName}</span>
        <Badge variant="outline" className="text-xs">
          {formatFileSize(attachment.size)}
        </Badge>
        {showDelete && onDelete && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onDelete(attachment.id)}
            className="h-6 w-6 p-0 hover:bg-destructive/10 hover:text-destructive"
          >
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>
    )
  }

  return (
    <>
      <Card>
        <CardContent className="p-3">
          <div className="flex items-start gap-3">
            {/* File icon or thumbnail */}
            <div className="flex-shrink-0">
              <div className="h-12 w-12 bg-muted rounded-lg flex items-center justify-center">
                {getFileIcon(attachment.type, 'h-5 w-5 text-muted-foreground')}
              </div>
            </div>
            
            {/* File details */}
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-medium truncate">{attachment.originalName}</h4>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline" className="text-xs">
                  {attachment.type ? attachment.type.split('/')[1]?.toUpperCase() || 'FILE' : 'FILE'}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {formatFileSize(attachment.size)}
                </span>
                <span className="text-xs text-muted-foreground">
                  {formatDate(attachment.uploadedAt)}
                </span>
              </div>
            </div>
            
            {/* Actions */}
            <div className="flex items-center gap-1">
              {attachment.type && attachment.type.startsWith('image/') && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handlePreview}
                  className="h-8 w-8 p-0"
                >
                  <Eye className="h-4 w-4" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDownload}
                className="h-8 w-8 p-0"
              >
                <Download className="h-4 w-4" />
              </Button>
              {showDelete && onDelete && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onDelete(attachment.id)}
                  className="h-8 w-8 p-0 hover:bg-destructive/10 hover:text-destructive"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Image preview dialog */}
      {attachment.type && attachment.type.startsWith('image/') && (
        <Dialog open={showPreview} onOpenChange={setShowPreview}>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle>{attachment.originalName}</DialogTitle>
            </DialogHeader>
            <div className="flex justify-center">
              {!previewError ? (
                <img
                  src={`/api/tasks/${attachment.id}/attachments/${attachment.id}`}
                  alt={attachment.originalName}
                  className="max-w-full max-h-[70vh] object-contain"
                  onError={() => setPreviewError(true)}
                />
              ) : (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <AlertCircle className="h-4 w-4" />
                  <span>Failed to load image preview</span>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  )
}