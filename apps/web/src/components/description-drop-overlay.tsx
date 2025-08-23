/**
 * Description Drop Overlay
 * Visual feedback overlay for drag & drop operations in description fields
 */

import React from 'react';
import { Upload, AlertCircle, Loader2, Image } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DescriptionDropOverlayProps {
  isVisible: boolean;
  isUploading?: boolean;
  error?: string | null;
  className?: string;
}

export function DescriptionDropOverlay({
  isVisible,
  isUploading = false,
  error = null,
  className
}: DescriptionDropOverlayProps) {
  if (!isVisible) return null;

  return (
    <div className={cn(
      "absolute inset-0 z-10 flex items-center justify-center",
      "bg-primary/10 border-2 border-dashed border-primary rounded-md",
      "pointer-events-none transition-all duration-200",
      className
    )}>
      <div className="flex flex-col items-center gap-2 p-4 bg-background/90 rounded-lg shadow-lg">
        {isUploading ? (
          <>
            <Loader2 className="h-8 w-8 text-primary animate-spin" />
            <div className="text-center">
              <p className="text-sm font-medium text-primary">Uploading images...</p>
              <p className="text-xs text-muted-foreground">Please wait</p>
            </div>
          </>
        ) : error ? (
          <>
            <AlertCircle className="h-8 w-8 text-red-500" />
            <div className="text-center">
              <p className="text-sm font-medium text-red-700">Upload Error</p>
              <p className="text-xs text-red-600">{error}</p>
            </div>
          </>
        ) : (
          <>
            <div className="relative">
              <Upload className="h-8 w-8 text-primary" />
              <Image className="h-4 w-4 text-primary absolute -top-1 -right-1 bg-background rounded-full" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-primary">Drop images here</p>
              <p className="text-xs text-muted-foreground">They'll be inserted at cursor position</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}