/**
 * Enhanced Description Editor with drag & drop image support
 * GitHub-style attachment system for task descriptions
 */

import React, { useState, useRef, useCallback } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Edit3, Eye, Upload, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DescriptionDropOverlay } from './description-drop-overlay';
import { DescriptionRenderer } from './description-renderer';
import { AttachmentTemplateInserter } from './attachment-template-inserter';
import { client } from '@/utils/orpc';

interface EnhancedDescriptionEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  rows?: number;
  className?: string;
  taskId?: string;
  projectId?: string;
  disabled?: boolean;
  showViewToggle?: boolean;
}

export function EnhancedDescriptionEditor({
  value,
  onChange,
  placeholder = "Add a description...",
  label = "Description",
  rows = 6,
  className,
  taskId,
  projectId,
  disabled = false,
  showViewToggle = true
}: EnhancedDescriptionEditorProps) {
  const [isEditing, setIsEditing] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    setUploadError(null);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Only set dragging to false if we're leaving the textarea itself
    if (e.currentTarget === e.target) {
      setIsDragging(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    setUploadError(null);

    if (!taskId || !projectId || disabled) return;

    const files = Array.from(e.dataTransfer.files);
    const imageFiles = files.filter(file => file.type.startsWith('image/'));

    if (imageFiles.length === 0) {
      setUploadError('Only image files are supported for drag & drop insertion');
      return;
    }

    if (imageFiles.length > 5) {
      setUploadError('Maximum 5 images can be uploaded at once');
      return;
    }

    setIsUploading(true);

    try {
      for (const file of imageFiles) {
        // Validate file size (10MB limit)
        if (file.size > 10 * 1024 * 1024) {
          setUploadError(`File ${file.name} is too large (max 10MB)`);
          continue;
        }

        // Upload file using existing attachment system
        const result = await client.tasks.uploadAttachment({
          taskId,
          file
        });

        if (result.attachment) {
          // Insert template at cursor position
          const templateInserter = new AttachmentTemplateInserter(textareaRef);
          const template = `![${file.name}](${result.attachment.id})`;
          const newValue = templateInserter.insertTemplate(value, template);
          onChange(newValue);
        } else {
          setUploadError(`Failed to upload ${file.name}`);
        }
      }
    } catch (error) {
      console.error('Upload error:', error);
      setUploadError('Failed to upload images. Please try again.');
    } finally {
      setIsUploading(false);
    }
  }, [value, onChange, taskId, projectId, disabled]);

  const toggleViewMode = useCallback(() => {
    setIsEditing(!isEditing);
    setUploadError(null);
  }, [isEditing]);

  if (!isEditing && showViewToggle) {
    return (
      <div className={className}>
        <div className="flex items-center justify-between mb-2">
          <Label>{label}</Label>
          <Button
            size="sm"
            variant="ghost"
            onClick={toggleViewMode}
            className="h-8 w-auto p-2"
            disabled={disabled}
          >
            <Edit3 className="h-4 w-4" />
          </Button>
        </div>
        <div className="min-h-[100px]">
          <DescriptionRenderer 
            content={value} 
            taskId={taskId}
            className="p-3 bg-muted/50 rounded-md"
          />
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-2">
        <Label htmlFor="description">{label}</Label>
        {showViewToggle && value.trim() && (
          <Button
            size="sm"
            variant="ghost"
            onClick={toggleViewMode}
            className="h-8 w-auto p-2"
            disabled={disabled}
          >
            <Eye className="h-4 w-4" />
          </Button>
        )}
      </div>
      
      <div className="relative">
        <Textarea
          ref={textareaRef}
          id="description"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={rows}
          disabled={disabled || isUploading}
          className={cn(
            "resize-none transition-all duration-200",
            isDragging && "ring-2 ring-primary border-primary bg-primary/5",
            isUploading && "opacity-50"
          )}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        />

        {/* Drag overlay */}
        {isDragging && (
          <DescriptionDropOverlay
            isVisible={isDragging}
            isUploading={isUploading}
            error={uploadError}
          />
        )}

        {/* Upload status indicator */}
        {isUploading && (
          <div className="absolute top-2 right-2 flex items-center gap-2 px-2 py-1 bg-primary text-primary-foreground rounded-md text-xs">
            <Upload className="h-3 w-3 animate-pulse" />
            Uploading...
          </div>
        )}
      </div>

      {/* Error display */}
      {uploadError && (
        <div className="flex items-center gap-2 mt-2 p-2 border border-red-200 bg-red-50 text-red-800 rounded-md">
          <AlertCircle className="h-4 w-4" />
          <span className="text-sm">{uploadError}</span>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setUploadError(null)}
            className="ml-auto h-6 w-6 p-0"
          >
            ×
          </Button>
        </div>
      )}
      
      {taskId && (
        <p className="text-xs text-muted-foreground mt-1">
          Drag & drop images to insert them at cursor position
        </p>
      )}
    </div>
  );
}