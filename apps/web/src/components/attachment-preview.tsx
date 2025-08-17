import { useState, useEffect } from 'react'
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
  taskId: string
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

function formatFileSize(bytes: number | undefined): string {
  if (!bytes || bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

function formatDate(dateString: string | undefined): string {
  if (!dateString) return 'Unknown date'
  try {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  } catch {
    return 'Invalid date'
  }
}

export function AttachmentPreview({ 
  attachment, 
  taskId,
  onDelete, 
  showDelete = true, 
  compact = false 
}: AttachmentPreviewProps) {
  const [showPreview, setShowPreview] = useState(false)
  const [previewError, setPreviewError] = useState(false)
  const [imageUrl, setImageUrl] = useState<string | null>(null)

  const handleDownload = async () => {
    try {
      // Get the server URL from environment (same as orpc client)
      const defaultServerUrl = "http://localhost:8500"
      const baseUrl = (import.meta.env.VITE_SERVER_URL as string | undefined) ?? defaultServerUrl
      
      const response = await fetch(`${baseUrl}/api/tasks/${taskId}/attachments/${attachment.id}/download`, {
        credentials: 'include'
      })
      if (response.ok) {
        const blob = await response.blob()
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = attachment.originalName
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(url)
      }
    } catch (error) {
      console.error('Failed to download file:', error)
    }
  }

  const handlePreview = async () => {
    if (attachment.type && attachment.type.startsWith('image/')) {
      try {
        // Get the server URL from environment (same as orpc client)
        const defaultServerUrl = "http://localhost:8500"
        const baseUrl = (import.meta.env.VITE_SERVER_URL as string | undefined) ?? defaultServerUrl
        
        const response = await fetch(`${baseUrl}/api/tasks/${taskId}/attachments/${attachment.id}/download`, {
          credentials: 'include'
        })
        if (response.ok) {
          const blob = await response.blob()
          const url = URL.createObjectURL(blob)
          setImageUrl(url)
          setShowPreview(true)
          setPreviewError(false)
        } else {
          setPreviewError(true)
        }
      } catch (error) {
        console.error('Failed to load image:', error)
        setPreviewError(true)
      }
    }
  }

  // Cleanup blob URL when component unmounts or preview closes
  useEffect(() => {
    return () => {
      if (imageUrl) {
        URL.revokeObjectURL(imageUrl)
      }
    }
  }, [imageUrl])

  useEffect(() => {
    if (!showPreview && imageUrl) {
      URL.revokeObjectURL(imageUrl)
      setImageUrl(null)
    }
  }, [showPreview, imageUrl])

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
              {!previewError && imageUrl ? (
                <img
                  src={imageUrl}
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