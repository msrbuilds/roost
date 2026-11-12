import { Router, type Request, type Response } from 'express';
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import multer from 'multer';
import crypto from 'crypto';
import { z } from 'zod';
import { supabaseAdmin } from '../lib/supabase.js';

export const uploadRouter = Router();

const region = process.env.AWS_REGION || 'us-east-1';
const bucketName = process.env.AWS_S3_BUCKET || '';
const s3Endpoint = process.env.S3_ENDPOINT?.trim().replace(/\/+$/, '') || undefined;
const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
if (!bucketName) throw new Error('AWS_S3_BUCKET is required');
if (Boolean(accessKeyId) !== Boolean(secretAccessKey)) throw new Error('Both AWS access-key variables must be configured together');
if (s3Endpoint && (!accessKeyId || !secretAccessKey)) throw new Error('S3-compatible storage requires explicit access credentials');
const s3Client = new S3Client({
  region,
  ...(accessKeyId && secretAccessKey ? { credentials: { accessKeyId, secretAccessKey } } : {}),
  ...(s3Endpoint ? { endpoint: s3Endpoint, forcePathStyle: true } : {}),
});

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const ALLOWED_TYPES = new Set([
  ...ALLOWED_IMAGE_TYPES,
  'video/mp4', 'video/webm', 'video/quicktime', 'application/pdf', 'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/markdown', 'text/x-markdown',
  'application/zip', 'application/x-zip-compressed', 'application/x-rar-compressed', 'application/vnd.rar', 'application/x-7z-compressed',
]);
const ALLOWED_FOLDER = /^(images|videos|documents|uploads|messages|activations\/products|avatars\/[a-f0-9-]{36}|groups\/[a-f0-9-]{36}\/(documents|posts))$/;
const PUBLIC_FOLDER = /^(images|avatars\/)/;
const MAX_FILE_SIZE = 100 * 1024 * 1024;
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE, files: 1, fields: 2, parts: 3 },
});

async function authenticateUser(req: Request) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return null;
  const { data, error } = await supabaseAdmin.auth.getUser(header.slice(7));
  return error ? null : data.user;
}

function cleanKeyPart(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-180);
}

function encodeKey(key: string) {
  return Buffer.from(key, 'utf8').toString('base64url');
}

function decodeKey(value: string) {
  return Buffer.from(value, 'base64url').toString('utf8');
}

function publicFileUrl(req: Request, key: string) {
  const configured = process.env.PUBLIC_API_URL?.replace(/\/+$/, '');
  const origin = configured || `${req.protocol}://${req.get('host')}`;
  return `${origin}/api/upload/public/${encodeKey(key)}`;
}

async function streamObject(key: string, res: Response) {
  const object = await s3Client.send(new GetObjectCommand({ Bucket: bucketName, Key: key }));
  if (object.ContentType) res.type(object.ContentType);
  if (object.ContentLength !== undefined) res.setHeader('Content-Length', object.ContentLength.toString());
  res.setHeader('X-Content-Type-Options', 'nosniff');
  const body = object.Body as NodeJS.ReadableStream | undefined;
  if (!body || typeof (body as { pipe?: unknown }).pipe !== 'function') throw new Error('Storage returned an unreadable body');
  body.pipe(res);
}

uploadRouter.post('/file', upload.single('file'), async (req, res) => {
  const user = await authenticateUser(req);
  if (!user) return res.status(401).json({ error: 'Authentication required' });
  if (!req.file) return res.status(400).json({ error: 'A file is required' });
  const folder = String(req.body.folder || 'uploads');
  if (!ALLOWED_FOLDER.test(folder)) return res.status(400).json({ error: 'Invalid upload folder' });
  if (!ALLOWED_TYPES.has(req.file.mimetype)) return res.status(400).json({ error: `File type not allowed: ${req.file.mimetype}` });
  const typeLimit = folder.startsWith('avatars/') ? 5 * 1024 * 1024 : ALLOWED_IMAGE_TYPES.includes(req.file.mimetype) ? 10 * 1024 * 1024 : MAX_FILE_SIZE;
  if (req.file.size > typeLimit) return res.status(413).json({ error: 'File is larger than the allowed limit' });

  const key = `users/${user.id}/${folder}/${Date.now()}-${crypto.randomUUID()}-${cleanKeyPart(req.file.originalname)}`;
  try {
    await s3Client.send(new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      Body: req.file.buffer,
      ContentType: req.file.mimetype,
      ContentLength: req.file.size,
      CacheControl: PUBLIC_FOLDER.test(folder) ? 'public,max-age=31536000,immutable' : 'private,no-store',
    }));
    return res.status(201).json({
      key,
      publicUrl: PUBLIC_FOLDER.test(folder) ? publicFileUrl(req, key) : `private:${key}`,
    });
  } catch (error) {
    console.error('[Upload] Failed:', error);
    return res.status(500).json({ error: 'Failed to store file' });
  }
});

uploadRouter.get('/public/:encodedKey', async (req, res) => {
  try {
    const key = decodeKey(req.params.encodedKey);
    if (!(/^(users\/[a-f0-9-]{36}\/(images|avatars\/)|branding\/)/.test(key)) || key.includes('..')) return res.status(404).end();
    res.setHeader('Cache-Control', 'public,max-age=31536000,immutable');
    return await streamObject(key, res);
  } catch (error) {
    console.error('[Upload] Public read failed:', error);
    return res.status(404).end();
  }
});

async function canReadPrivateKey(userId: string, key: string): Promise<boolean> {
  const { data: profile } = await supabaseAdmin.from('profiles').select('role, membership_type').eq('id', userId).single();
  if (profile?.role === 'admin' || profile?.role === 'superadmin') return true;

  const { data: asset } = await supabaseAdmin
    .from('assets')
    .select('uploaded_by, message_id, post_id, group_assets(group_id), messages!assets_message_id_fkey(sender_id, recipient_id), posts!assets_post_id_fkey(group_id)')
    .eq('storage_key', key)
    .maybeSingle();
  if (asset) {
    if (asset.uploaded_by === userId) return true;
    const message = Array.isArray(asset.messages) ? asset.messages[0] : asset.messages;
    if (message && (message.sender_id === userId || message.recipient_id === userId)) return true;
    const groupIds = new Set<string>();
    const post = Array.isArray(asset.posts) ? asset.posts[0] : asset.posts;
    if (post?.group_id) groupIds.add(post.group_id);
    for (const link of asset.group_assets || []) if (link.group_id) groupIds.add(link.group_id);
    for (const groupId of groupIds) {
      const [{ data: membership }, { data: group }] = await Promise.all([
        supabaseAdmin.from('group_members').select('id').eq('group_id', groupId).eq('user_id', userId).maybeSingle(),
        supabaseAdmin.from('groups').select('is_premium').eq('id', groupId).single(),
      ]);
      if (membership && (!group?.is_premium || profile?.membership_type === 'premium' || profile?.role === 'moderator')) return true;
    }
  }

  const marker = `private:${key}`;
  const { data: product } = await supabaseAdmin.from('activation_products').select('id').eq('file_url', marker).maybeSingle();
  if (product) {
    const { data: completed } = await supabaseAdmin.from('activation_requests').select('id').eq('product_id', product.id).eq('user_id', userId).eq('status', 'completed').maybeSingle();
    if (completed) return true;
  }
  return false;
}

uploadRouter.get('/content/:encodedKey', async (req, res) => {
  const user = await authenticateUser(req);
  if (!user) return res.status(401).json({ error: 'Authentication required' });
  try {
    const key = decodeKey(req.params.encodedKey);
    if (!key.startsWith('users/') || key.includes('..') || !(await canReadPrivateKey(user.id, key))) return res.status(403).json({ error: 'File access denied' });
    res.setHeader('Cache-Control', 'private,no-store');
    return await streamObject(key, res);
  } catch (error) {
    console.error('[Upload] Private read failed:', error);
    return res.status(404).json({ error: 'File not found' });
  }
});

uploadRouter.post('/delete', async (req, res) => {
  const user = await authenticateUser(req);
  if (!user) return res.status(401).json({ error: 'Authentication required' });
  const parsed = z.object({ key: z.string().min(1).max(500) }).safeParse(req.body);
  if (!parsed.success || parsed.data.key.includes('..')) return res.status(400).json({ error: 'Invalid file key' });
  const { data: profile } = await supabaseAdmin.from('profiles').select('role').eq('id', user.id).single();
  const isAdmin = profile?.role === 'admin' || profile?.role === 'superadmin';
  if (!isAdmin && !parsed.data.key.startsWith(`users/${user.id}/`)) return res.status(403).json({ error: 'You can only delete your own files' });
  try {
    await s3Client.send(new DeleteObjectCommand({ Bucket: bucketName, Key: parsed.data.key }));
    return res.json({ success: true });
  } catch (error) {
    console.error('[Upload] Delete failed:', error);
    return res.status(500).json({ error: 'Failed to delete file' });
  }
});
