"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.backupRouter = void 0;
const express_1 = require("express");
const backup_js_1 = require("../services/backup.js");
const supabase_js_1 = require("../lib/supabase.js");
const crypto_1 = __importDefault(require("crypto"));
const router = (0, express_1.Router)();
exports.backupRouter = router;
/**
 * Middleware to verify admin/superadmin access
 */
async function requireAdmin(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Authorization required' });
    }
    const token = authHeader.substring(7);
    try {
        // Verify the token and get user
        const { data: { user }, error } = await supabase_js_1.supabaseAdmin.auth.getUser(token);
        if (error || !user) {
            return res.status(401).json({ error: 'Invalid token' });
        }
        // Check if user is admin or superadmin
        const { data: profile } = await supabase_js_1.supabaseAdmin
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single();
        if (!profile || !['admin', 'superadmin'].includes(profile.role)) {
            return res.status(403).json({ error: 'Admin access required' });
        }
        next();
    }
    catch (error) {
        console.error('Auth error:', error);
        return res.status(500).json({ error: 'Authentication failed' });
    }
}
/**
 * Middleware to verify backup secret token (for automated/CI triggers)
 */
function requireBackupToken(req, res, next) {
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
    const isValid = crypto_1.default.timingSafeEqual(Buffer.from(providedToken), Buffer.from(backupToken));
    if (!isValid) {
        return res.status(401).json({ error: 'Invalid backup token' });
    }
    next();
}
/**
 * POST /api/backup/trigger
 * Trigger a database backup (admin auth required)
 */
router.post('/trigger', requireAdmin, async (_req, res) => {
    try {
        console.log('[Backup API] Manual backup triggered by admin');
        const result = await (0, backup_js_1.performBackup)();
        if (result.success) {
            res.json({
                message: 'Backup completed successfully',
                ...result,
            });
        }
        else {
            res.status(500).json({
                message: 'Backup failed',
                error: result.error,
            });
        }
    }
    catch (error) {
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
router.post('/automated', requireBackupToken, async (_req, res) => {
    try {
        console.log('[Backup API] Automated backup triggered');
        const result = await (0, backup_js_1.performBackup)();
        if (result.success) {
            res.json({
                message: 'Backup completed successfully',
                ...result,
            });
        }
        else {
            res.status(500).json({
                message: 'Backup failed',
                error: result.error,
            });
        }
    }
    catch (error) {
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
router.get('/list', requireAdmin, async (_req, res) => {
    try {
        const backups = await (0, backup_js_1.listBackups)();
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
    }
    catch (error) {
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
router.get('/download/:filename', requireAdmin, async (req, res) => {
    try {
        const filename = req.params.filename;
        if (!filename) {
            return res.status(400).json({ error: 'Filename is required' });
        }
        console.log(`[Backup API] Download requested for: ${filename}`);
        const downloadUrl = await (0, backup_js_1.getBackupDownloadUrl)(filename);
        res.json({ downloadUrl });
    }
    catch (error) {
        console.error('[Backup API] Download error:', error);
        res.status(500).json({
            error: 'Failed to generate download URL',
            message: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});
//# sourceMappingURL=backup.js.map