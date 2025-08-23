/**
 * Attachment Template Inserter
 * Utility for inserting attachment templates at cursor position in textareas
 */

export class AttachmentTemplateInserter {
  private textareaRef: React.RefObject<HTMLTextAreaElement | null>;

  constructor(textareaRef: React.RefObject<HTMLTextAreaElement | null>) {
    this.textareaRef = textareaRef;
  }

  /**
   * Get the current cursor position in the textarea
   */
  getCursorPosition(): number {
    const textarea = this.textareaRef.current;
    if (!textarea) return 0;
    return textarea.selectionStart || 0;
  }

  /**
   * Set the cursor position in the textarea
   */
  setCursorPosition(position: number): void {
    const textarea = this.textareaRef.current;
    if (!textarea) return;
    
    textarea.focus();
    textarea.setSelectionRange(position, position);
  }

  /**
   * Insert a template string at the current cursor position
   */
  insertTemplate(currentValue: string, template: string): string {
    const textarea = this.textareaRef.current;
    if (!textarea) return currentValue;

    const cursorPosition = this.getCursorPosition();
    const beforeCursor = currentValue.substring(0, cursorPosition);
    const afterCursor = currentValue.substring(cursorPosition);

    // Determine if we need newlines around the template
    const needsNewlineBefore = beforeCursor.length > 0 && !beforeCursor.endsWith('\n');
    const needsNewlineAfter = afterCursor.length > 0 && !afterCursor.startsWith('\n');

    // Construct the insertion
    let insertion = template;
    if (needsNewlineBefore) insertion = '\n' + insertion;
    if (needsNewlineAfter) insertion = insertion + '\n';

    const newValue = beforeCursor + insertion + afterCursor;
    const newCursorPosition = cursorPosition + insertion.length;

    // Set the new cursor position after a brief delay to allow React to update
    setTimeout(() => {
      this.setCursorPosition(newCursorPosition);
    }, 0);

    return newValue;
  }

  /**
   * Insert multiple templates at once (useful for multiple file uploads)
   */
  insertMultipleTemplates(currentValue: string, templates: string[]): string {
    let result = currentValue;
    
    templates.forEach((template, index) => {
      result = this.insertTemplate(result, template);
    });

    return result;
  }

  /**
   * Check if a template already exists in the text
   */
  templateExists(text: string, attachmentId: string): boolean {
    const templatePattern = new RegExp(`!\\[[^\\]]*\\]\\(${escapeRegExp(attachmentId)}\\)`, 'g');
    return templatePattern.test(text);
  }

  /**
   * Remove a template from the text
   */
  removeTemplate(text: string, attachmentId: string): string {
    const templatePattern = new RegExp(`!\\[[^\\]]*\\]\\(${escapeRegExp(attachmentId)}\\)\\n?`, 'g');
    return text.replace(templatePattern, '');
  }

  /**
   * Update a template's alt text
   */
  updateTemplateAltText(text: string, attachmentId: string, newAltText: string): string {
    const templatePattern = new RegExp(`(!\\[)[^\\]]*\\](\\(${escapeRegExp(attachmentId)}\\))`, 'g');
    return text.replace(templatePattern, `$1${newAltText}$2`);
  }

  /**
   * Extract all attachment IDs from templates in the text
   */
  extractAttachmentIds(text: string): string[] {
    const templatePattern = /!\[[^\]]*\]\(([^)]+)\)/g;
    const attachmentIds: string[] = [];
    let match;

    while ((match = templatePattern.exec(text)) !== null) {
      const attachmentId = match[1];
      // Only include IDs that look like attachment references (not URLs)
      if (!attachmentId.startsWith('http') && !attachmentId.startsWith('/') && !attachmentId.startsWith('data:')) {
        attachmentIds.push(attachmentId);
      }
    }

    return Array.from(new Set(attachmentIds)); // Remove duplicates
  }

  /**
   * Validate that all templates in the text have corresponding attachments
   */
  validateTemplates(text: string, validAttachmentIds: string[]): {
    valid: boolean;
    invalidIds: string[];
    orphanedTemplates: string[];
  } {
    const templateIds = this.extractAttachmentIds(text);
    const invalidIds = templateIds.filter(id => !validAttachmentIds.includes(id));
    
    const orphanedTemplates = invalidIds.map(id => {
      const match = text.match(new RegExp(`!\\[[^\\]]*\\]\\(${escapeRegExp(id)}\\)`, 'g'));
      return match ? match[0] : `![](${id})`;
    });

    return {
      valid: invalidIds.length === 0,
      invalidIds,
      orphanedTemplates
    };
  }
}

/**
 * Escape special regex characters
 */
function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}