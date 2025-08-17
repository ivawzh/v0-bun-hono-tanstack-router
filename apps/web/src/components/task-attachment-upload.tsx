import { useState } from 'react'
import { AttachmentDropzone, type AttachmentFile } from './attachment-dropzone'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Upload, Loader2 } from 'lucide-react'
import { client } from '@/utils/orpc'
import { useMutation, useQueryClient } from '@tanstack/react-query'

interface TaskAttachmentUploadProps {
  taskId: string
}

export function TaskAttachmentUpload({ taskId }: TaskAttachmentUploadProps) {
  const [attachments, setAttachments] = useState<AttachmentFile[]>([])
  const queryClient = useQueryClient()

  const uploadMutation = useMutation({
    mutationFn: async (file: AttachmentFile) => {
      const buffer = await file.file.arrayBuffer()
      return client.tasks.uploadAttachment({
        taskId,
        file: {
          buffer: new Uint8Array(buffer),
          originalName: file.file.name,
          type: file.file.type,
          size: file.file.size
        }
      })
    },
    onSuccess: () => {
      // Clear uploaded attachments
      setAttachments([])
      // Invalidate task queries to refresh the attachment list
      queryClient.invalidateQueries({ queryKey: ['projects'] })
    },
    onError: (error) => {
      console.error('Failed to upload attachment:', error)
    }
  })

  const handleUpload = async () => {
    if (attachments.length > 0) {
      // Upload files one by one
      for (const attachment of attachments) {
        try {
          await uploadMutation.mutateAsync(attachment)
        } catch (error) {
          console.error('Failed to upload file:', attachment.file.name, error)
          break // Stop on first error
        }
      }
    }
  }

  const canUpload = attachments.length > 0 && !uploadMutation.isPending

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Upload className="h-4 w-4" />
          Add Attachments
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <AttachmentDropzone
          attachments={attachments}
          onAttachmentsChange={setAttachments}
          disabled={uploadMutation.isPending}
        />
        
        {attachments.length > 0 && (
          <div className="flex justify-end">
            <Button 
              onClick={handleUpload}
              disabled={!canUpload}
              className="gap-2"
            >
              {uploadMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  Upload {attachments.length} file{attachments.length > 1 ? 's' : ''}
                </>
              )}
            </Button>
          </div>
        )}
        
        {uploadMutation.isError && (
          <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-2">
            Failed to upload attachments. Please try again.
          </div>
        )}
      </CardContent>
    </Card>
  )
}