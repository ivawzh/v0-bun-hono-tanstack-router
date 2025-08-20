import { useState } from 'react'
import { AttachmentDropzone, type AttachmentFile } from './attachment-dropzone'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Upload, Loader2 } from 'lucide-react'
import { client } from '@/utils/orpc'
import { useMutation } from '@tanstack/react-query'
import { useCacheUtils } from '@/hooks/use-cache-utils'

interface TaskAttachmentUploadProps {
  taskId: string
  projectId?: string
}

export function TaskAttachmentUpload({ taskId, projectId }: TaskAttachmentUploadProps) {
  const [attachments, setAttachments] = useState<AttachmentFile[]>([])
  const cache = useCacheUtils()

  const uploadMutation = useMutation({
    onMutate: async (file: AttachmentFile) => {
      // Create optimistic attachment entry
      const optimisticAttachment = {
        id: `temp-${Date.now()}-${Math.random()}`,
        taskId,
        filename: file.file.name,
        originalName: file.file.name,
        size: file.file.size,
        mimeType: file.file.type,
        uploadedAt: new Date().toISOString(),
        uploadedBy: 'current-user', // This would come from auth context
      }

      // Try to optimistically update task data if we can get project context
      try {
        const taskQuery = cache.queryKeys.tasks.detail(taskId)
        const currentTaskData = cache.getCachedData(taskQuery)
        
        if (currentTaskData) {
          const updatedTask = {
            ...currentTaskData,
            attachments: [...((currentTaskData as any).attachments || []), optimisticAttachment]
          }
          cache.setCachedData(taskQuery, updatedTask)
        }
      } catch (error) {
        console.warn('Could not perform optimistic update:', error)
      }

      return { optimisticAttachment }
    },
    mutationFn: async (file: AttachmentFile) => {
      console.log('📤 Starting upload for file:', {
        name: file.file.name,
        size: file.file.size,
        type: file.file.type,
        taskId
      });
      
      // Use oRPC client for type-safe file upload
      const result = await client.tasks.uploadAttachment({
        taskId,
        file: file.file
      });
      
      console.log('✅ Upload successful:', result);
      return result;
    },
    onSuccess: async (result) => {
      // Clear uploaded attachments
      setAttachments([])
      
      // Use improved attachment invalidation that handles all related queries
      // Prioritize passed projectId, then result projectId
      const targetProjectId = projectId || result?.projectId
      await cache.invalidateAttachments(taskId, targetProjectId)
      
      // Also ensure task details are refreshed to show updated attachment count
      await cache.invalidateTask(taskId, targetProjectId)
    },
    onError: (error, file, context) => {
      console.error('Failed to upload attachment:', error)
      
      // Rollback optimistic update by removing the temporary attachment
      if (context?.optimisticAttachment) {
        try {
          const taskQuery = cache.queryKeys.tasks.detail(taskId)
          const currentTaskData = cache.getCachedData(taskQuery)
          
          if (currentTaskData && (currentTaskData as any).attachments) {
            const updatedTask = {
              ...currentTaskData,
              attachments: (currentTaskData as any).attachments.filter(
                (att: any) => att.id !== context.optimisticAttachment.id
              )
            }
            cache.setCachedData(taskQuery, updatedTask)
          }
        } catch (rollbackError) {
          console.warn('Could not rollback optimistic update:', rollbackError)
        }
      }
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