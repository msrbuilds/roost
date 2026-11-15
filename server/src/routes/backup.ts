import { Router, Request, Response } from 'express';
import { performBackup, listBackups, getBackupDownloadUrl, getBackupFile } from '../services/backup.js';
import { supabaseAdmin } from '../lib/supabase.js';
import crypto from 'crypto';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';

const router = Router();

/**
 * Middleware to verify admin/superadmin access
 */
async function requireAdmin(req: Request, res: Response, next: () => void) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authorization required' });
  }

  const token = authHeader.substring(7);

  try {
    // Verify the token and get user
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    // Check if user is admin or superadmin
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile || !['admin', 'superadmin'].includes(profile.role)) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    next();
  } catch (error) {
    console.error('Auth error:', error);
    return res.status(500).json({ error: 'Authentication failed' });
  }
}

/**
 * Middleware to verify backup secret token (for automated/CI triggers)
 */
function requireBackupToken(req: Request, res: Response, next: () => void) {
  const backupToken = process.env.BACKUP_SECRET_TOKEN;

  if (!backupToken) {
    return res.status(500).json({ error: 'Backup token not configured on server' });
  }

  // Only accept token via header (not query params, to avoid token leaking in access logs)
  const providedToken = req.headers['x-backup-token'];

  if (typeof providedToken !== 'string' || providedToken.length !== backupToken.length) {
    return res.status(401).json({ error: 'Invalid backup token' });
  }

  // Timing-safe comparison to prevent timing attacks
  const isValid = crypto.timingSafeEqual(
    Buffer.from(providedToken),
    Buffer.from(backupToken)
  );

  if (!isValid) {
    return res.status(401).json({ error: 'Invalid backup token' });
  }

  next();
}

/**
 * POST /api/backup/trigger
 * Trigger a database backup (admin auth required)
 */
router.post('/trigger', requireAdmin, async (_req: Request, res: Response) => {
  try {
    console.log('[Backup API] Manual backup triggered by admin');
    const result = await performBackup();

    if (result.success) {
      res.json({
        message: 'Backup completed successfully',
        ...result,
      });
    } else {
      res.status(500).json({
        message: 'Backup failed',
        error: result.error,
      });
    }
  } catch (error) {
    console.error('[Backup API] Error:', error);
    res.status(500).json({
      error: 'Failed to trigger backup',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/backup/automated
 * Trigger backup via secret token (for CI/CD or cron jobs)
 */
router.post('/automated', requireBackupToken, async (_req: Request, res: Response) => {
  try {
    console.log('[Backup API] Automated backup triggered');
    const result = await performBackup();

    if (result.success) {
      res.json({
        message: 'Backup completed successfully',
        ...result,
      });
    } else {
      res.status(500).json({
        message: 'Backup failed',
        error: result.error,
      });
    }
  } catch (error) {
    console.error('[Backup API] Error:', error);
    res.status(500).json({
      error: 'Failed to trigger backup',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/backup/list
 * List recent backups (admin auth required)
 */
router.get('/list', requireAdmin, async (_req: Request, res: Response) => {
  try {
    const backups = await listBackups();

    res.json({
      count: backups.length,
      backups: backups.map(b => {
        // Extract just the filename from the S3 key (remove any prefix)
        const filename = b.key.split('/').pop() || b.key;
        return {
          filename,
          sizeMB: (b.size / (1024 * 1024)).toFixed(2),
          createdAt: b.lastModified.toISOString(),
        };
      }),
    });
  } catch (error) {
    console.error('[Backup API] List error:', error);
    res.status(500).json({
      error: 'Failed to list backups',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/backup/download/:filename
 * Get a pre-signed download URL for a backup file (admin auth required)
 */
router.get('/download/:filename', requireAdmin, async (req: Request, res: Response) => {
  try {
    const filename = req.params.filename as string;

    if (!/^backup-[A-Za-z0-9-]+\.sql\.gz$/.test(filename)) {
      return res.status(400).json({ error: 'Invalid backup filename' });
    }

    console.log(`[Backup API] Download requested for: ${filename}`);
    const downloadUrl = await getBackupDownloadUrl(filename);

    res.json({ downloadUrl });
  } catch (error) {
    console.error('[Backup API] Download error:', error);
    res.status(500).json({
      error: 'Failed to generate download URL',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Keep private storage endpoints and storage credentials out of browser downloads.
router.get('/file/:filename', requireAdmin, async (req: Request, res: Response) => {
  const filename = req.params.filename as string;
  if (!/^backup-[A-Za-z0-9-]+\.sql\.gz$/.test(filename)) {
    return res.status(400).json({ error: 'Invalid backup filename' });
  }
  try {
    const object = await getBackupFile(filename);
    if (!(object.Body instanceof Readable)) throw new Error('Storage returned an unreadable backup');
    res.setHeader('Content-Type', 'application/gzip');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    if (object.ContentLength !== undefined) res.setHeader('Content-Length', String(object.ContentLength));
    await pipeline(object.Body, res);
  } catch (error) {
    console.error('[Backup API] File download failed:', error);
    if (!res.headersSent) res.status(500).json({ error: 'Failed to download backup' });
    else res.destroy();
  }
});

export { router as backupRouter };
