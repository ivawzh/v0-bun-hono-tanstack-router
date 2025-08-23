/**
 * Description Renderer
 * Renders descriptions with embedded image thumbnails and markdown support
 */

import React, { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/utils';
import { Image as ImageIcon, AlertCircle } from 'lucide-react';

interface AttachmentImageProps {
  attachmentId: string;
  alt: string;
  taskId?: string;
}

function AttachmentImage({ attachmentId, alt, taskId }: AttachmentImageProps) {
  const [isLoading, setIsLoading] = React.useState(true);
  const [hasError, setHasError] = React.useState(false);
  
  // Construct attachment URL - this should match your existing attachment serving logic
  const imageUrl = taskId ? `/api/tasks/${taskId}/attachments/${attachmentId}` : null;

  const handleLoad = () => {
    setIsLoading(false);
    setHasError(false);
  };

  const handleError = () => {
    setIsLoading(false);
    setHasError(true);
  };

  if (!imageUrl) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 bg-muted rounded text-xs text-muted-foreground">
        <ImageIcon className="h-3 w-3" />
        {alt || 'Image'}
      </span>
    );
  }

  if (hasError) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-50 border border-red-200 rounded text-xs text-red-600">
        <AlertCircle className="h-3 w-3" />
        {alt || 'Image not found'}
      </span>
    );
  }

  return (
    <span className="inline-block relative">
      {isLoading && (
        <span className="inline-flex items-center gap-1 px-2 py-1 bg-muted rounded text-xs text-muted-foreground">
          <div className="h-3 w-3 animate-pulse bg-current rounded" />
          Loading...
        </span>
      )}
      <img
        src={imageUrl}
        alt={alt}
        onLoad={handleLoad}
        onError={handleError}
        className={cn(
          "inline-block max-w-full h-auto max-h-16 rounded border shadow-sm transition-all duration-200",
          "hover:max-h-32 hover:shadow-md cursor-zoom-in",
          isLoading && "hidden"
        )}
        title={alt}
      />
    </span>
  );
}

interface DescriptionRendererProps {
  content: string;
  taskId?: string;
  className?: string;
}

export function DescriptionRenderer({
  content,
  taskId,
  className
}: DescriptionRendererProps) {
  // Custom renderer for images that handles attachment references
  const components = useMemo(() => ({
    img: ({ src, alt, ...props }: any) => {
      // Check if this is an attachment reference (![description](attachment-id))
      if (src && !src.startsWith('http') && !src.startsWith('/') && !src.startsWith('data:')) {
        return <AttachmentImage attachmentId={src} alt={alt || ''} taskId={taskId} />;
      }
      
      // Regular image URL
      return (
        <img
          src={src}
          alt={alt}
          className="inline-block max-w-full h-auto max-h-16 rounded border shadow-sm hover:max-h-32 hover:shadow-md transition-all duration-200 cursor-zoom-in"
          {...props}
        />
      );
    },
    p: ({ children, ...props }: any) => (
      <p className="mb-2 last:mb-0" {...props}>{children}</p>
    ),
    ul: ({ children, ...props }: any) => (
      <ul className="list-disc list-inside mb-2 space-y-1" {...props}>{children}</ul>
    ),
    ol: ({ children, ...props }: any) => (
      <ol className="list-decimal list-inside mb-2 space-y-1" {...props}>{children}</ol>
    ),
    code: ({ inline, children, ...props }: any) => {
      if (inline) {
        return (
          <code className="px-1 py-0.5 bg-muted rounded text-sm font-mono" {...props}>
            {children}
          </code>
        );
      }
      return (
        <pre className="p-2 bg-muted rounded text-sm font-mono overflow-x-auto mb-2">
          <code {...props}>{children}</code>
        </pre>
      );
    },
    blockquote: ({ children, ...props }: any) => (
      <blockquote className="border-l-4 border-muted-foreground/25 pl-4 mb-2 text-muted-foreground" {...props}>
        {children}
      </blockquote>
    ),
    hr: (props: any) => (
      <hr className="my-4 border-muted-foreground/25" {...props} />
    ),
    table: ({ children, ...props }: any) => (
      <div className="overflow-x-auto mb-2">
        <table className="min-w-full border-collapse border border-muted-foreground/25" {...props}>
          {children}
        </table>
      </div>
    ),
    th: ({ children, ...props }: any) => (
      <th className="border border-muted-foreground/25 px-2 py-1 bg-muted font-medium text-left" {...props}>
        {children}
      </th>
    ),
    td: ({ children, ...props }: any) => (
      <td className="border border-muted-foreground/25 px-2 py-1" {...props}>
        {children}
      </td>
    ),
  }), [taskId]);

  if (!content?.trim()) {
    return (
      <div className={cn("text-muted-foreground text-sm italic", className)}>
        No description yet
      </div>
    );
  }

  return (
    <div className={cn("text-sm prose-sm max-w-none", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={components}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}