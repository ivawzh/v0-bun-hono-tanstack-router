import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { Upload, X, FileText, Image, File, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

export interface AttachmentFile {
  id: string
  file: File
  preview?: string
}

interface AttachmentDropzoneProps {
  attachments?: AttachmentFile[]
  onAttachmentsChange: (attachments: AttachmentFile[]) => void
  maxFiles?: number
  maxSize?: number
  disabled?: boolean
}

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const MAX_TOTAL_SIZE = 50 * 1024 * 1024 // 50MB

const SUPPORTED_TYPES = {
  'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp'],
  'application/pdf': ['.pdf'],
  'text/plain': ['.txt'],
  'text/markdown': ['.md'],
  'application/json': ['.json'],
  'text/javascript': ['.js'],
  'text/typescript': ['.ts'],
  'text/html': ['.html'],
  'text/css': ['.css'],
  'application/zip': ['.zip'],
  'application/x-tar': ['.tar'],
  'application/gzip': ['.gz']
}

function getFileIcon(file: File) {
  if (file.type.startsWith('image/')) return <Image className="h-4 w-4" />
  if (file.type === 'application/pdf') return <FileText className="h-4 w-4" />
  if (file.type.startsWith('text/') || file.type === 'application/json') return <FileText className="h-4 w-4" />
  return <File className="h-4 w-4" />
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

export function AttachmentDropzone({
  attachments = [],
  onAttachmentsChange,
  maxFiles = 10,
  maxSize = MAX_FILE_SIZE,
  disabled = false
}: AttachmentDropzoneProps) {
  const [error, setError] = useState<string | null>(null)

  const onDrop = useCallback((acceptedFiles: File[], rejectedFiles: any[]) => {
    setError(null)

    // Handle rejected files
    if (rejectedFiles.length > 0) {
      const errors = rejectedFiles.map(({ errors }) => errors[0]?.message).filter(Boolean)
      setError(errors.join(', '))
      return
    }

    // Check total size limit
    const currentTotalSize = attachments.reduce((sum, att) => sum + att.file.size, 0)
    const newTotalSize = acceptedFiles.reduce((sum, file) => sum + file.size, 0)
    
    if (currentTotalSize + newTotalSize > MAX_TOTAL_SIZE) {
      setError(`Total attachment size would exceed ${MAX_TOTAL_SIZE / 1024 / 1024}MB limit`)
      return
    }

    // Check max files limit
    if (attachments.length + acceptedFiles.length > maxFiles) {
      setError(`Maximum ${maxFiles} files allowed`)
      return
    }

    // Create new attachments with previews for images
    const newAttachments = acceptedFiles.map(file => {
      const id = crypto.randomUUID()
      const attachment: AttachmentFile = { id, file }
      
      // Create preview for images
      if (file.type.startsWith('image/')) {
        attachment.preview = URL.createObjectURL(file)
      }
      
      return attachment
    })

    onAttachmentsChange([...attachments, ...newAttachments])
  }, [attachments, onAttachmentsChange, maxFiles])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: SUPPORTED_TYPES,
    maxSize,
    disabled
  })

  const removeAttachment = (id: string) => {
    const updatedAttachments = attachments.filter(att => {
      if (att.id === id && att.preview) {
        URL.revokeObjectURL(att.preview)
      }
      return att.id !== id
    })
    onAttachmentsChange(updatedAttachments)
  }

  const totalSize = attachments.reduce((sum, att) => sum + att.file.size, 0)

  return (
    <div className="space-y-3">
      {/* Dropzone */}
      <div
        {...getRootProps()}
        className={cn(
          'border-2 border-dashed rounded-lg p-6 cursor-pointer transition-colors',
          isDragActive 
            ? 'border-primary bg-primary/5' 
            : 'border-muted-foreground/25 hover:border-muted-foreground/50',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center gap-2 text-center">
          <Upload className={cn(
            'h-8 w-8',
            isDragActive ? 'text-primary' : 'text-muted-foreground'
          )} />
          <div className="text-sm">
            {isDragActive ? (
              <p className="text-primary font-medium">Drop files here...</p>
            ) : (
              <>
                <p className="font-medium">Drag & drop files here</p>
                <p className="text-muted-foreground">or click to select files</p>
              </>
            )}
          </div>
          <div className="text-xs text-muted-foreground">
            Max {formatFileSize(maxSize)} per file, {formatFileSize(MAX_TOTAL_SIZE)} total
          </div>
        </div>
      </div>

      {/* Error display */}
      {error && (
        <div className="flex items-center gap-2 p-3 border border-red-200 bg-red-50 text-red-800 rounded-md">
          <AlertCircle className="h-4 w-4" />
          <span className="text-sm">{error}</span>
        </div>
      )}

      {/* Attachment previews */}
      {attachments.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Attachments ({attachments.length})</p>
            <p className="text-xs text-muted-foreground">
              {formatFileSize(totalSize)} / {formatFileSize(MAX_TOTAL_SIZE)}
            </p>
          </div>
          
          <div className="grid grid-cols-1 gap-2">
            {attachments.map((attachment) => (
              <Card key={attachment.id} className="p-3">
                <div className="flex items-center gap-3">
                  {/* File icon or image preview */}
                  <div className="flex-shrink-0">
                    {attachment.preview ? (
                      <img
                        src={attachment.preview}
                        alt={attachment.file.name}
                        className="h-10 w-10 object-cover rounded"
                      />
                    ) : (
                      <div className="h-10 w-10 bg-muted rounded flex items-center justify-center">
                        {getFileIcon(attachment.file)}
                      </div>
                    )}
                  </div>
                  
                  {/* File details */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{attachment.file.name}</p>
                    <div className="flex items-center gap-2">
                      <p className="text-xs text-muted-foreground">
                        {formatFileSize(attachment.file.size)}
                      </p>
                      <Badge variant="outline" className="text-xs">
                        {attachment.file.type.split('/')[1]?.toUpperCase() || 'FILE'}
                      </Badge>
                    </div>
                  </div>
                  
                  {/* Remove button */}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeAttachment(attachment.id)}
                    className="h-8 w-8 p-0 hover:bg-destructive/10 hover:text-destructive"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}