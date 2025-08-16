import { promises as fs } from 'fs'
import path from 'path'
import crypto from 'crypto'

export interface AttachmentMetadata {
  id: string
  filename: string
  originalName: string
  path: string
  size: number
  type: string
  uploadedAt: string
}

const ATTACHMENTS_BASE_DIR = '.solo-unicorn/attachments'
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const MAX_TOTAL_SIZE = 50 * 1024 * 1024 // 50MB

const SUPPORTED_TYPES = [
  // Images
  'image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/svg+xml', 'image/webp',
  // Documents
  'application/pdf', 'text/plain', 'text/markdown',
  'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  // Code files
  'text/javascript', 'text/typescript', 'application/json', 'text/html', 'text/css',
  // Archives
  'application/zip', 'application/x-tar', 'application/gzip'
]

export function validateFile(file: { size: number; type: string; name: string }) {
  if (file.size > MAX_FILE_SIZE) {
    throw new Error(`File size exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit`)
  }

  if (!SUPPORTED_TYPES.includes(file.type) && !file.type.startsWith('text/')) {
    throw new Error('Unsupported file type')
  }

  // Sanitize filename
  const sanitizedName = sanitizeFilename(file.name)
  if (!sanitizedName) {
    throw new Error('Invalid filename')
  }

  return sanitizedName
}

export function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/^\.+/, '')
    .substring(0, 255)
}

export function getTaskAttachmentDir(taskId: string): string {
  return path.join(process.cwd(), ATTACHMENTS_BASE_DIR, taskId)
}

export async function ensureAttachmentDir(taskId: string): Promise<string> {
  const dir = getTaskAttachmentDir(taskId)
  await fs.mkdir(dir, { recursive: true })
  return dir
}

export async function saveAttachment(
  taskId: string,
  file: { buffer: Buffer; originalName: string; type: string; size: number }
): Promise<AttachmentMetadata> {
  const sanitizedName = validateFile({
    size: file.size,
    type: file.type,
    name: file.originalName
  })

  const attachmentDir = await ensureAttachmentDir(taskId)
  
  // Generate unique filename to handle collisions
  const id = crypto.randomUUID()
  const ext = path.extname(sanitizedName)
  const base = path.basename(sanitizedName, ext)
  const filename = `${base}_${id.substring(0, 8)}${ext}`
  
  const filePath = path.join(attachmentDir, filename)
  
  await fs.writeFile(filePath, file.buffer)

  return {
    id,
    filename,
    originalName: file.originalName,
    path: filePath,
    size: file.size,
    type: file.type,
    uploadedAt: new Date().toISOString()
  }
}

export async function deleteAttachment(taskId: string, attachmentId: string, attachments: AttachmentMetadata[]): Promise<void> {
  const attachment = attachments.find(a => a.id === attachmentId)
  if (!attachment) {
    throw new Error('Attachment not found')
  }

  try {
    await fs.unlink(attachment.path)
  } catch (error) {
    // File might already be deleted, log but don't throw
    console.warn(`Failed to delete attachment file: ${attachment.path}`, error)
  }
}

export async function getAttachmentFile(taskId: string, attachmentId: string, attachments: AttachmentMetadata[]): Promise<Buffer> {
  const attachment = attachments.find(a => a.id === attachmentId)
  if (!attachment) {
    throw new Error('Attachment not found')
  }

  return await fs.readFile(attachment.path)
}

export async function validateTotalAttachmentSize(taskId: string, newFileSize: number, existingAttachments: AttachmentMetadata[]): Promise<void> {
  const currentTotal = existingAttachments.reduce((sum, att) => sum + att.size, 0)
  
  if (currentTotal + newFileSize > MAX_TOTAL_SIZE) {
    throw new Error(`Total attachment size would exceed ${MAX_TOTAL_SIZE / 1024 / 1024}MB limit`)
  }
}

export function getFileIcon(type: string): string {
  if (type.startsWith('image/')) return '🖼️'
  if (type === 'application/pdf') return '📄'
  if (type.startsWith('text/') || type === 'application/json') return '📝'
  if (type.includes('word') || type.includes('document')) return '📝'
  if (type.includes('zip') || type.includes('tar') || type.includes('gzip')) return '📦'
  return '📎'
}