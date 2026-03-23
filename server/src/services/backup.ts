import { exec } from 'child_process';
import { promisify } from 'util';
import { S3Client, PutObjectCommand, ListObjectsV2Command, DeleteObjectsCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { createReadStream, unlinkSync, statSync } from 'fs';
import { createGzip } from 'zlib';
import { pipeline } from 'stream/promises';
import { createWriteStream } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const execAsync = promisify(exec);

// S3 Configuration for Backups
// Uses a SEPARATE private bucket for security (database backups should never be public)
const s3Client = new S3Client({
  region: process.env.AWS_BACKUP_REGION || process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_BACKUP_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_BACKUP_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY || '',
  },
});

// IMPORTANT: Use AWS_BACKUP_BUCKET for a private bucket separate from public uploads
const BUCKET_NAME = process.env.AWS_BACKUP_BUCKET || '';
const BACKUP_PREFIX = 'backups/';
const MAX_BACKUPS = 30; // Keep last 30 backups (~ 1 month of daily backups)

interface BackupResult {
  success: boolean;
  filename?: string;
  s3Key?: string;
  size?: number;
  duration?: number;
  error?: string;
}

/**
 * Get database connection parameters for pg_dump
 *
 * Supports both Supabase Cloud (via pooler) and self-hosted Supabase (direct connection).
 *
 * For self-hosted: Set SUPABASE_DB_HOST (e.g., 'localhost' or server IP)
 * For Supabase Cloud: Set SUPABASE_POOLER_HOST (e.g., 'aws-1-ap-southeast-1.pooler.supabase.com')
 */
function getDatabaseConnectionParams(): { host: string; port: string; user: string; password: string; database: string } {
  const dbPassword = process.env.SUPABASE_DB_PASSWORD || '';
  const dbHost = process.env.SUPABASE_DB_HOST || '';
  const dbPort = process.env.SUPABASE_DB_PORT || '5432';
  const dbUser = process.env.SUPABASE_DB_USER || 'postgres';
  const dbName = process.env.SUPABASE_DB_NAME || 'postgres';

  // Self-hosted Supabase: Use direct connection
  if (dbHost) {
    if (!dbPassword) {
      throw new Error('SUPABASE_DB_PASSWORD is required for backups');
    }
    return {
      host: dbHost,
      port: dbPort,
      user: dbUser,
      password: dbPassword,
      database: dbName,
    };
  }

  // Supabase Cloud: Use pooler connection
  const supabaseUrl = process.env.SUPABASE_URL || '';
  const poolerHost = process.env.SUPABASE_POOLER_HOST || '';

  if (!supabaseUrl || !dbPassword) {
    throw new Error('SUPABASE_URL and SUPABASE_DB_PASSWORD are required for backups');
  }

  if (!poolerHost) {
    throw new Error('SUPABASE_DB_HOST (self-hosted) or SUPABASE_POOLER_HOST (cloud) is required');
  }

  // Extract project ref from Supabase URL (https://[project-ref].supabase.co)
  const projectRef = supabaseUrl.replace('https://', '').split('.')[0];

  return {
    host: poolerHost,
    port: '5432',
    user: `postgres.${projectRef}`,
    password: dbPassword,
    database: 'postgres',
  };
}

/**
 * Create a database backup using pg_dump
 */
async function createDatabaseDump(): Promise<{ filepath: string; filename: string }> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `backup-${timestamp}.sql`;
  const filepath = join(tmpdir(), filename);

  const { host, port, user, password, database } = getDatabaseConnectionParams();

  // Run pg_dump with explicit parameters to avoid IPv6 issues
  // PGPASSWORD env var is used to pass password securely (not visible in process list)
  // Using separate flags instead of connection string for better compatibility
  const command = `pg_dump -h "${host}" -p ${port} -U ${user} -d ${database} --no-owner --no-acl --clean --if-exists -f "${filepath}"`;

  try {
    await execAsync(command, {
      timeout: 300000, // 5 minute timeout
      maxBuffer: 50 * 1024 * 1024, // 50MB buffer
      env: {
        ...process.env,
        PGPASSWORD: password, // Pass password via environment variable
      },
    });
    return { filepath, filename };
  } catch (error) {
    // Clean up partial file if it exists
    try { unlinkSync(filepath); } catch { /* ignore */ }
    throw error;
  }
}

/**
 * Compress a file using gzip
 */
async function compressFile(inputPath: string): Promise<string> {
  const outputPath = `${inputPath}.gz`;

  await pipeline(
    createReadStream(inputPath),
    createGzip({ level: 9 }),
    createWriteStream(outputPath)
  );

  // Remove original uncompressed file
  unlinkSync(inputPath);

  return outputPath;
}

/**
 * Upload backup to S3
 */
async function uploadToS3(filepath: string, filename: string): Promise<string> {
  const s3Key = `${BACKUP_PREFIX}${filename}`;
  const fileStream = createReadStream(filepath);
  const fileStats = statSync(filepath);

  await s3Client.send(new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: s3Key,
    Body: fileStream,
    ContentType: 'application/gzip',
    ContentLength: fileStats.size,
    Metadata: {
      'backup-type': 'database',
      'created-at': new Date().toISOString(),
    },
  }));

  return s3Key;
}

/**
 * Clean up old backups, keeping only the most recent ones
 */
async function cleanupOldBackups(): Promise<number> {
  // List all backups
  const listResponse = await s3Client.send(new ListObjectsV2Command({
    Bucket: BUCKET_NAME,
    Prefix: BACKUP_PREFIX,
  }));

  const objects = listResponse.Contents || [];

  if (objects.length <= MAX_BACKUPS) {
    return 0;
  }

  // Sort by LastModified descending (newest first)
  objects.sort((a, b) => {
    const dateA = a.LastModified?.getTime() || 0;
    const dateB = b.LastModified?.getTime() || 0;
    return dateB - dateA;
  });

  // Get objects to delete (everything after MAX_BACKUPS)
  const objectsToDelete = objects.slice(MAX_BACKUPS);

  if (objectsToDelete.length === 0) {
    return 0;
  }

  // Delete old backups
  await s3Client.send(new DeleteObjectsCommand({
    Bucket: BUCKET_NAME,
    Delete: {
      Objects: objectsToDelete.map(obj => ({ Key: obj.Key })),
    },
  }));

  return objectsToDelete.length;
}

/**
 * Main backup function - creates dump, compresses, uploads to S3, cleans up
 */
export async function performBackup(): Promise<BackupResult> {
  const startTime = Date.now();
  let tempFilepath: string | null = null;

  try {
    // Validate configuration
    if (!BUCKET_NAME) {
      throw new Error('AWS_BACKUP_BUCKET environment variable is required for database backups');
    }
    const accessKey = process.env.AWS_BACKUP_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID;
    const secretKey = process.env.AWS_BACKUP_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY;
    if (!accessKey || !secretKey) {
      throw new Error('AWS credentials (AWS_BACKUP_ACCESS_KEY_ID/AWS_ACCESS_KEY_ID, AWS_BACKUP_SECRET_ACCESS_KEY/AWS_SECRET_ACCESS_KEY) are required');
    }

    console.log('[Backup] Starting database backup...');

    // Step 1: Create database dump
    console.log('[Backup] Creating database dump...');
    const { filepath, filename } = await createDatabaseDump();
    tempFilepath = filepath;

    // Step 2: Compress the dump
    console.log('[Backup] Compressing backup...');
    const compressedPath = await compressFile(filepath);
    tempFilepath = compressedPath;
    const compressedFilename = `${filename}.gz`;

    // Step 3: Upload to S3
    console.log('[Backup] Uploading to S3...');
    const s3Key = await uploadToS3(compressedPath, compressedFilename);

    // Get file size before cleanup
    const fileStats = statSync(compressedPath);
    const fileSizeMB = (fileStats.size / (1024 * 1024)).toFixed(2);

    // Step 4: Clean up local temp file
    unlinkSync(compressedPath);
    tempFilepath = null;

    // Step 5: Clean up old S3 backups
    console.log('[Backup] Cleaning up old backups...');
    const deletedCount = await cleanupOldBackups();
    if (deletedCount > 0) {
      console.log(`[Backup] Deleted ${deletedCount} old backup(s)`);
    }

    const duration = (Date.now() - startTime) / 1000;
    console.log(`[Backup] Completed successfully in ${duration.toFixed(1)}s - ${fileSizeMB}MB uploaded to ${s3Key}`);

    return {
      success: true,
      filename: compressedFilename,
      s3Key,
      size: fileStats.size,
      duration,
    };

  } catch (error) {
    // Clean up temp file on error
    if (tempFilepath) {
      try { unlinkSync(tempFilepath); } catch { /* ignore */ }
    }

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Backup] Failed:', errorMessage);

    return {
      success: false,
      error: errorMessage,
      duration: (Date.now() - startTime) / 1000,
    };
  }
}

/**
 * List recent backups from S3
 */
export async function listBackups(): Promise<Array<{ key: string; size: number; lastModified: Date }>> {
  const response = await s3Client.send(new ListObjectsV2Command({
    Bucket: BUCKET_NAME,
    Prefix: BACKUP_PREFIX,
  }));

  const objects = response.Contents || [];

  return objects
    .map(obj => ({
      key: obj.Key || '',
      size: obj.Size || 0,
      lastModified: obj.LastModified || new Date(),
    }))
    .sort((a, b) => b.lastModified.getTime() - a.lastModified.getTime());
}

/**
 * Generate a pre-signed download URL for a backup file
 * URL expires after 15 minutes for security
 */
export async function getBackupDownloadUrl(filename: string): Promise<string> {
  const s3Key = `${BACKUP_PREFIX}${filename}`;

  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: s3Key,
    ResponseContentDisposition: `attachment; filename="${filename}"`,
  });

  const url = await getSignedUrl(s3Client, command, { expiresIn: 900 }); // 15 minutes
  return url;
}
