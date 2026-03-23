import { Router, Request, Response } from 'express';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { supabaseAdmin } from '../lib/supabase.js';
import { z } from 'zod';
import crypto from 'crypto';

export const uploadRouter = Router();

// S3 Configuration (server-side only - credentials never exposed to frontend)
const region = process.env.AWS_REGION || 'us-east-1';
const bucketName = process.env.AWS_S3_BUCKET || '';
const accessKeyId = process.env.AWS_ACCESS_KEY_ID || '';
const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY || '';

const s3Client = new S3Client({
  region,
  credentials: {
    accessKeyId,
    secretAccessKey,
  },
});

// Allowed MIME types
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'];
const ALLOWED_DOCUMENT_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/markdown',
  'text/x-markdown',
];
const ALLOWED_ARCHIVE_TYPES = [
  'application/zip',
  'application/x-zip-compressed',
  'application/x-rar-compressed',
  'application/vnd.rar',
  'application/x-7z-compressed',
];
const ALL_ALLOWED_TYPES = [...ALLOWED_IMAGE_TYPES, ...ALLOWED_VIDEO_TYPES, ...ALLOWED_DOCUMENT_TYPES, ...ALLOWED_ARCHIVE_TYPES];

// Allowed folder patterns for presigned URL generation
// Must match exactly the folders used by frontend code:
//   images, videos, documents, uploads, activations/products,
//   avatars/{uuid}, groups/{uuid}/documents
const ALLOWED_FOLDER_PATTERN = /^(images|videos|documents|uploads|activations\/products|avatars\/[a-f0-9-]{36}|groups\/[a-f0-9-]{36}\/documents)$/;

// Allowed key prefixes for delete operations
const ALLOWED_DELETE_PREFIXES = [
  'images/',
  'videos/',
  'documents/',
  'uploads/',
  'avatars/',
  'groups/',
  'activations/',
];

// Size limits per type
const MAX_IMAGE_SIZE = 10 * 1024 * 1024;  // 10MB
const MAX_AVATAR_SIZE = 5 * 1024 * 1024;  // 5MB
const MAX_FILE_SIZE = 100 * 1024 * 1024;  // 100MB

// Validation schemas
const presignRequestSchema = z.object({
  fileName: z.string().min(1).max(255),
  fileType: z.string().min(1),
  fileSize: z.number().positive(),
  folder: z.string().min(1).max(100).default('uploads'),
});

const deleteRequestSchema = z.object({
  key: z.string().min(1).max(500),
});

// Authenticate user from Bearer token
async function authenticateUser(req: Request): Promise<string | null> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return null;

  const token = authHeader.substring(7);
  try {
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !user) return null;
    return user.id;
  } catch {
    return null;
  }
}

// Generate unique file key
function generateFileKey(folder: string, fileName: string): string {
  const timestamp = Date.now();
  const randomId = crypto.randomUUID();
  const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
  return `${folder}/${timestamp}-${randomId}-${sanitizedFileName}`;
}

// Get public URL for a file
function getPublicUrl(key: string): string {
  return `https://${bucketName}.s3.${region}.amazonaws.com/${key}`;
}

/**
 * POST /api/upload/presign
 * Generate a pre-signed URL for direct S3 upload from the browser.
 * The browser then uploads directly to S3 using the pre-signed URL.
 */
uploadRouter.post('/presign', async (req: Request, res: Response) => {
  // Authenticate
  const userId = await authenticateUser(req);
  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  // Validate request body
  const parsed = presignRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid request', details: parsed.error.errors });
  }

  const { fileName, fileType, fileSize, folder } = parsed.data;

  // Validate folder against allowed patterns
  if (!ALLOWED_FOLDER_PATTERN.test(folder)) {
    console.warn(`[Upload] Rejected folder value: "${folder}" from user ${userId}`);
    return res.status(400).json({ error: 'Invalid upload folder' });
  }

  // Validate file type
  if (!ALL_ALLOWED_TYPES.includes(fileType)) {
    return res.status(400).json({ error: `File type not allowed: ${fileType}` });
  }

  // Validate file size based on folder/type
  let maxSize = MAX_FILE_SIZE;
  if (folder.startsWith('avatars')) {
    maxSize = MAX_AVATAR_SIZE;
  } else if (ALLOWED_IMAGE_TYPES.includes(fileType)) {
    maxSize = MAX_IMAGE_SIZE;
  }

  if (fileSize > maxSize) {
    return res.status(400).json({
      error: `File too large. Maximum size: ${Math.round(maxSize / (1024 * 1024))}MB`,
    });
  }

  try {
    const key = generateFileKey(folder, fileName);

    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      ContentType: fileType,
      ContentLength: fileSize,
      CacheControl: 'max-age=31536000',
    });

    const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn: 300 }); // 5 min

    res.json({
      presignedUrl,
      key,
      publicUrl: getPublicUrl(key),
    });
  } catch (error) {
    console.error('[Upload] Pre-sign error:', error);
    res.status(500).json({ error: 'Failed to generate upload URL' });
  }
});

/**
 * POST /api/upload/delete
 * Delete a file from S3 (must be authenticated).
 */
uploadRouter.post('/delete', async (req: Request, res: Response) => {
  const userId = await authenticateUser(req);
  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const parsed = deleteRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid request' });
  }

  const { key } = parsed.data;

  // Validate key starts with an allowed prefix
  const hasValidPrefix = ALLOWED_DELETE_PREFIXES.some(prefix => key.startsWith(prefix));
  if (!hasValidPrefix) {
    console.warn(`[Upload] Rejected delete key: "${key}" from user ${userId}`);
    return res.status(400).json({ error: 'Invalid file key' });
  }

  // Prevent path traversal in key
  if (key.includes('..') || key.includes('//')) {
    console.warn(`[Upload] Path traversal attempt in delete key: "${key}" from user ${userId}`);
    return res.status(400).json({ error: 'Invalid file key' });
  }

  try {
    // Ownership check: verify the file belongs to the requesting user
    const publicUrl = getPublicUrl(key);

    // Check if user is admin/superadmin (admins can delete any file)
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single();

    const isAdmin = profile?.role === 'admin' || profile?.role === 'superadmin';

    if (!isAdmin) {
      // Look up the asset record to verify ownership
      const { data: asset } = await supabaseAdmin
        .from('assets')
        .select('uploaded_by')
        .eq('file_url', publicUrl)
        .single();

      if (asset) {
        // Asset record found — verify ownership
        if (asset.uploaded_by !== userId) {
          console.warn(`[Upload] Unauthorized delete: user ${userId} tried to delete file owned by ${asset.uploaded_by}, key="${key}"`);
          return res.status(403).json({ error: 'You can only delete your own files' });
        }
      } else {
        // No asset record found — allow only if key contains the user's ID
        // (covers avatar uploads and other user-scoped paths like avatars/{userId}/...)
        if (!key.includes(userId)) {
          console.warn(`[Upload] Unauthorized delete: user ${userId} tried to delete unowned file, key="${key}"`);
          return res.status(403).json({ error: 'You can only delete your own files' });
        }
      }
    }

    console.log(`[Upload] Delete requested: key="${key}" by user=${userId}`);
    await s3Client.send(new DeleteObjectCommand({
      Bucket: bucketName,
      Key: key,
    }));

    res.json({ success: true });
  } catch (error) {
    console.error('[Upload] Delete error:', error);
    res.status(500).json({ error: 'Failed to delete file' });
  }
});
