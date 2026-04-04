import { Router, Request, Response } from 'express';
import { supabaseAdmin } from '../lib/supabase.js';
import { getCachedUserProfile } from '../services/cache.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

export const siteSettingsRouter = Router();

// S3 client (reuse existing config)
const s3Region = process.env.AWS_REGION || 'us-east-1';
const s3Bucket = process.env.AWS_S3_BUCKET || '';
const s3AccessKey = process.env.AWS_ACCESS_KEY_ID || '';
const s3SecretKey = process.env.AWS_SECRET_ACCESS_KEY || '';
const s3Endpoint = process.env.S3_ENDPOINT?.trim().replace(/\/+$/, '') || undefined;

const hasS3 = !!(s3Bucket && s3AccessKey && s3SecretKey);

const s3Client = hasS3
  ? new S3Client({
      region: s3Region,
      credentials: { accessKeyId: s3AccessKey, secretAccessKey: s3SecretKey },
      ...(s3Endpoint ? { endpoint: s3Endpoint, forcePathStyle: true } : {}),
    })
  : null;

// Local upload directory (fallback when S3 is not configured)
const LOCAL_UPLOAD_DIR = path.join(process.cwd(), 'uploads', 'branding');

// Multer for file uploads (max 2MB for logos/favicons)
const upload = multer({
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp', 'image/x-icon', 'image/vnd.microsoft.icon'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only image files (PNG, JPG, SVG, WebP, ICO) are allowed'));
    }
  },
  storage: multer.memoryStorage(),
});

// Auth middleware: require superadmin
async function requireSuperadmin(req: Request, res: Response, next: () => void) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing authorization token' });
  }

  const token = authHeader.substring(7);
  try {
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const profile = await getCachedUserProfile(user.id, async () => {
      const { data } = await supabaseAdmin
        .from('profiles')
        .select('id, role, is_banned')
        .eq('id', user.id)
        .single();
      return data;
    });

    if (!profile || profile.role !== 'superadmin') {
      return res.status(403).json({ error: 'Superadmin access required' });
    }

    next();
  } catch {
    res.status(500).json({ error: 'Authorization failed' });
  }
}

// GET /api/site-settings/manifest.webmanifest — dynamic PWA manifest from site settings
siteSettingsRouter.get('/manifest.webmanifest', async (_req: Request, res: Response) => {
  try {
    const { data } = await supabaseAdmin
      .from('site_settings')
      .select('key, value');

    const settings: Record<string, string> = {};
    for (const row of data || []) {
      settings[row.key] = row.value || '';
    }

    const manifest = {
      name: settings.site_name || 'Roost',
      short_name: settings.site_name || 'Roost',
      description: settings.site_description || 'A community platform for learning, building, and growing together',
      icons: [
        { src: '/android-chrome-192x192.png', sizes: '192x192', type: 'image/png' },
        { src: '/android-chrome-512x512.png', sizes: '512x512', type: 'image/png' },
      ],
      theme_color: settings.primary_color || '#0ea5e9',
      background_color: '#ffffff',
      display: 'standalone',
      start_url: '/',
    };

    res.setHeader('Content-Type', 'application/manifest+json');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.json(manifest);
  } catch (error) {
    console.error('Error generating manifest:', error);
    res.status(500).json({ error: 'Failed to generate manifest' });
  }
});

// GET /api/site-settings — public, returns all settings as key-value object
siteSettingsRouter.get('/', async (_req: Request, res: Response) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('site_settings')
      .select('key, value');

    if (error) throw error;

    const settings: Record<string, string> = {};
    for (const row of data || []) {
      settings[row.key] = row.value || '';
    }

    res.json(settings);
  } catch (error) {
    console.error('Error fetching site settings:', error);
    res.status(500).json({ error: 'Failed to fetch site settings' });
  }
});

// PUT /api/site-settings — superadmin only, update settings
siteSettingsRouter.put('/', requireSuperadmin, async (req: Request, res: Response) => {
  try {
    const settings = req.body as Record<string, string>;

    const allowedKeys = [
      'site_name', 'site_tagline', 'site_description',
      'primary_color', 'logo_url', 'logo_dark_url', 'favicon_url',
      'support_email', 'support_url',
      'feature_live_room', 'feature_activations', 'feature_roadmap', 'feature_showcase',
    ];

    const updates = Object.entries(settings)
      .filter(([key]) => allowedKeys.includes(key))
      .map(([key, value]) => ({
        key,
        value: value || '',
        updated_at: new Date().toISOString(),
      }));

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No valid settings provided' });
    }

    for (const update of updates) {
      await supabaseAdmin
        .from('site_settings')
        .upsert(update, { onConflict: 'key' });
    }

    res.json({ success: true, updated: updates.length });
  } catch (error) {
    console.error('Error updating site settings:', error);
    res.status(500).json({ error: 'Failed to update site settings' });
  }
});

// POST /api/site-settings/upload — superadmin only, upload logo/favicon
siteSettingsRouter.post('/upload', requireSuperadmin, upload.single('file'), async (req: Request, res: Response) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    const type = req.body.type as string; // 'logo', 'logo_dark', 'favicon'
    if (!['logo', 'logo_dark', 'favicon'].includes(type)) {
      return res.status(400).json({ error: 'Invalid upload type. Must be: logo, logo_dark, or favicon' });
    }

    const ext = path.extname(file.originalname) || '.png';
    const filename = `branding/${type}-${crypto.randomBytes(8).toString('hex')}${ext}`;

    let fileUrl: string;

    if (hasS3 && s3Client) {
      // Upload to S3
      await s3Client.send(new PutObjectCommand({
        Bucket: s3Bucket,
        Key: filename,
        Body: file.buffer,
        ContentType: file.mimetype,
        CacheControl: 'public, max-age=31536000',
      }));

      const normalizedFilename = filename.replace(/^\/+/, '');
      if (s3Endpoint) {
        fileUrl = `${s3Endpoint}/${s3Bucket}/${normalizedFilename}`;
      } else {
        fileUrl = `https://${s3Bucket}.s3.${s3Region}.amazonaws.com/${normalizedFilename}`;
      }
    } else {
      // Fallback: save to local filesystem
      if (!fs.existsSync(LOCAL_UPLOAD_DIR)) {
        fs.mkdirSync(LOCAL_UPLOAD_DIR, { recursive: true });
      }

      const localPath = path.join(LOCAL_UPLOAD_DIR, `${type}-${crypto.randomBytes(8).toString('hex')}${ext}`);
      fs.writeFileSync(localPath, file.buffer);

      // Return full URL so frontend (different port in dev) can resolve it
      const apiUrl = process.env.FRONTEND_URL
        ? `${process.env.FRONTEND_URL.replace(/:\d+$/, '')}:${process.env.PORT || 3000}`
        : `http://localhost:${process.env.PORT || 3000}`;
      fileUrl = `${apiUrl}/uploads/branding/${path.basename(localPath)}`;
    }

    // Update the setting in database
    const settingKey = type === 'logo' ? 'logo_url'
      : type === 'logo_dark' ? 'logo_dark_url'
      : 'favicon_url';

    await supabaseAdmin
      .from('site_settings')
      .upsert({
        key: settingKey,
        value: fileUrl,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'key' });

    res.json({ success: true, url: fileUrl, key: settingKey });
  } catch (error) {
    console.error('Error uploading branding asset:', error);
    res.status(500).json({ error: 'Failed to upload file' });
  }
});
