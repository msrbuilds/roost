# Database Backup System

This guide covers the complete setup and configuration of automated database backups for Commune.

## Overview

The backup system provides:
- **Automated pre-deployment backups** - Triggers before every Docker build
- **Manual backups** - Via Admin Dashboard or API
- **Secure storage** - Private S3 bucket (separate from public uploads)
- **Retention policy** - Keeps the last 30 backups automatically
- **Compression** - Gzip compression for efficient storage

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Git Push      │────▶│  Dokploy Build   │────▶│  Docker Build   │
└─────────────────┘     └──────────────────┘     └────────┬────────┘
                                                          │
                                                          ▼
                                               ┌──────────────────┐
                                               │ Stage 0: Backup  │
                                               │ (calls prod API) │
                                               └────────┬─────────┘
                                                        │
                                                        ▼
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Private S3     │◀────│  Backend Server  │◀────│   pg_dump       │
│  Backup Bucket  │     │  /api/backup     │     │   (Supabase)    │
└─────────────────┘     └──────────────────┘     └─────────────────┘
```

## Prerequisites

1. **AWS Account** with S3 access
2. **Supabase Project** with database password
3. **Dokploy** deployment configured

---

## Step 1: Create a Private S3 Bucket

### Via AWS Console

1. Go to **S3** → **Create bucket**
2. **Bucket name**: `your-project-backups` (e.g., `msrbuilds-backups`)
3. **AWS Region**: Same as your main bucket (e.g., `us-east-1`)
4. **Object Ownership**: ACLs disabled (recommended)
5. **Block Public Access settings**:
   - ✅ **Block *all* public access** (CRITICAL - check this box)
6. **Bucket Versioning**: Optional (recommended for extra safety)
7. **Default encryption**:
   - Server-side encryption: **Enable**
   - Encryption type: **Amazon S3-managed keys (SSE-S3)**
8. Click **Create bucket**

### Via AWS CLI

```bash
# Create the bucket
aws s3api create-bucket \
  --bucket msrbuilds-backups \
  --region us-east-1

# Block all public access
aws s3api put-public-access-block \
  --bucket msrbuilds-backups \
  --public-access-block-configuration \
  "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"

# Enable encryption
aws s3api put-bucket-encryption \
  --bucket msrbuilds-backups \
  --server-side-encryption-configuration \
  '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}'
```

---

## Step 2: Configure IAM Permissions

Your IAM user/role needs permissions for the backup bucket. You can either:

### Option A: Use the Same IAM User (Simpler)

If using the same IAM user as your public bucket, add this policy:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "BackupBucketAccess",
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:ListBucket",
        "s3:DeleteObject"
      ],
      "Resource": [
        "arn:aws:s3:::msrbuilds-backups",
        "arn:aws:s3:::msrbuilds-backups/*"
      ]
    }
  ]
}
```

### Option B: Create a Dedicated Backup IAM User (More Secure)

1. Go to **IAM** → **Users** → **Create user**
2. User name: `msrbuilds-backup-service`
3. Attach the policy above
4. Create access keys and save them securely

---

## Step 3: Get Your Supabase Database Credentials

### 3a. Database Password

1. Go to your **Supabase Dashboard**
2. Navigate to **Project Settings** → **Database**
3. Under **Connection string**, find the password or click "Reset database password"
4. Save this password securely - you'll need it for `SUPABASE_DB_PASSWORD`

**Note**: This is NOT the same as your `SUPABASE_SECRET_KEY`. The database password is specifically for direct PostgreSQL connections.

### 3b. Session Pooler Host (Required for IPv4)

Supabase free tier only supports IPv6 for direct connections, which doesn't work in most Docker/VPS environments. You must use the Session Pooler which supports IPv4.

1. Go to your **Supabase Dashboard**
2. Navigate to **Project Settings** → **Database**
3. Under **Connection string**, select **Session Pooler** (not Direct or Transaction)
4. Copy the hostname from the connection string

Example connection string:
```
postgresql://postgres.yourproject:[YOUR-PASSWORD]@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres
```

From this, extract the **host**: `aws-1-ap-southeast-1.pooler.supabase.com`

Save this as `SUPABASE_POOLER_HOST`.

---

## Step 4: Generate a Backup Secret Token

Generate a secure random token for authenticating automated backup requests:

```bash
# Using openssl
openssl rand -hex 32

# Or using node
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Save this token - you'll use it for `BACKUP_SECRET_TOKEN`.

---

## Step 5: Configure Environment Variables

### For Dokploy

Add these environment variables to your Dokploy project:

| Variable | Description | Example |
|----------|-------------|---------|
| `AWS_BACKUP_BUCKET` | Private S3 bucket name | `msrbuilds-backups` |
| `AWS_BACKUP_REGION` | Bucket region (optional, defaults to AWS_REGION) | `us-east-1` |
| `AWS_BACKUP_ACCESS_KEY_ID` | IAM access key (optional, defaults to `AWS_ACCESS_KEY_ID`) | `AKIA...` |
| `AWS_BACKUP_SECRET_ACCESS_KEY` | IAM secret key (optional, defaults to `AWS_SECRET_ACCESS_KEY`) | `wJalr...` |
| `SUPABASE_DB_PASSWORD` | Supabase database password | `your-db-password` |
| `SUPABASE_POOLER_HOST` | Session Pooler hostname (required for IPv4) | `aws-1-ap-southeast-1.pooler.supabase.com` |
| `BACKUP_SECRET_TOKEN` | Secret token for automated backups | `your-random-token` |
| `BACKUP_API_URL` | URL of your running backend (for pre-build backups) | `https://your-domain.com` |

### For Local Development (.env)

```env
# Backup Configuration
AWS_BACKUP_BUCKET=msrbuilds-backups
AWS_BACKUP_REGION=us-east-1
# AWS_BACKUP_ACCESS_KEY_ID=  # Optional: falls back to AWS_ACCESS_KEY_ID
# AWS_BACKUP_SECRET_ACCESS_KEY=  # Optional: falls back to AWS_SECRET_ACCESS_KEY
SUPABASE_DB_PASSWORD=your-database-password
SUPABASE_POOLER_HOST=aws-1-ap-southeast-1.pooler.supabase.com
BACKUP_SECRET_TOKEN=your-secret-token

# For pre-build backups (Docker)
BACKUP_API_URL=https://your-domain.com
```

---

## Step 6: Verify Configuration

### Test the Backend Locally

```bash
cd server
npm run dev
```

Then call the backup API:

```bash
curl -X POST http://localhost:3000/api/backup/automated \
  -H "x-backup-token: your-secret-token"
```

### Check S3 Bucket

After a successful backup, verify the file exists:

```bash
aws s3 ls s3://msrbuilds-backups/backups/
```

---

## Usage

### Automatic Backups (Pre-Deployment)

Backups are triggered automatically when Dokploy builds your Docker image:

1. You push code to your Git repository
2. Dokploy detects the change and starts a build
3. Docker Stage 0 runs the backup script
4. The script calls your production server's `/api/backup/automated` endpoint
5. The server creates a pg_dump, compresses it, and uploads to S3
6. Docker continues with the normal build process

### Manual Backups (Admin Dashboard)

1. Log in as an admin user
2. Go to **Admin** → **Backups**
3. Click **"Create Backup Now"**
4. Wait for the backup to complete
5. View the backup in the history table

### Manual Backups (API)

**With Admin Authentication:**

```bash
curl -X POST https://your-domain.com/api/backup/trigger \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**With Backup Token (for scripts/cron):**

```bash
curl -X POST https://your-domain.com/api/backup/automated \
  -H "x-backup-token: YOUR_BACKUP_SECRET_TOKEN"
```

### List Backups (API)

```bash
curl https://your-domain.com/api/backup/list \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

## Restoring from Backup

### Download the Backup

```bash
# List available backups
aws s3 ls s3://msrbuilds-backups/backups/

# Download a specific backup
aws s3 cp s3://msrbuilds-backups/backups/backup-2024-01-15T10-30-00-000Z.sql.gz ./backup.sql.gz

# Decompress
gunzip backup.sql.gz
```

### Restore to Supabase

**Option 1: Via psql (Direct Connection)**

```bash
# Get your connection string from Supabase Dashboard
psql "postgresql://postgres:YOUR_PASSWORD@db.YOUR_PROJECT.supabase.co:5432/postgres" < backup.sql
```

**Option 2: Via Supabase CLI**

```bash
supabase db reset --db-url "postgresql://postgres:YOUR_PASSWORD@db.YOUR_PROJECT.supabase.co:5432/postgres"
psql "postgresql://postgres:YOUR_PASSWORD@db.YOUR_PROJECT.supabase.co:5432/postgres" < backup.sql
```

**Warning**: Restoring will overwrite existing data. Always test on a staging environment first.

---

## Retention Policy

The system automatically manages backup retention:

- **Maximum backups**: 30 (configurable in `server/src/services/backup.ts`)
- **Cleanup**: Oldest backups are deleted when the limit is exceeded
- **Frequency**: With daily deployments, this provides ~1 month of backup history

To change the retention policy, modify `MAX_BACKUPS` in the backup service.

---

## Troubleshooting

### Backup Fails with "AWS_BACKUP_BUCKET environment variable is required"

Ensure `AWS_BACKUP_BUCKET` is set in your Dokploy environment variables.

### Backup Fails with "DATABASE_URL or SUPABASE_URL + SUPABASE_DB_PASSWORD required"

Ensure `SUPABASE_DB_PASSWORD` is set. This is your Supabase database password, not the API key.

### Pre-Build Backup Doesn't Run

1. Check that `BACKUP_API_URL` and `BACKUP_SECRET_TOKEN` are set as build arguments
2. Verify your production server is running and accessible
3. Check the Docker build logs for the backup stage output

### "Access Denied" Errors

1. Verify your IAM user has the correct S3 permissions
2. Ensure the bucket policy doesn't block your IAM user
3. Check that the bucket name is spelled correctly

### pg_dump Connection Errors

1. Verify `SUPABASE_DB_PASSWORD` is correct
2. Ensure `SUPABASE_POOLER_HOST` is set correctly (required for IPv4 environments)
3. Check if there are IP allowlist restrictions in Supabase

### "Network unreachable" or IPv6 Errors

Supabase free tier only supports IPv6 for direct connections. Most Docker/VPS environments require IPv4.

**Solution**: Use the Session Pooler by setting `SUPABASE_POOLER_HOST`:
1. Go to Supabase Dashboard → Project Settings → Database
2. Select **Session Pooler** connection string
3. Extract the hostname (e.g., `aws-1-ap-southeast-1.pooler.supabase.com`)
4. Set `SUPABASE_POOLER_HOST` in your environment

### "Tenant or user not found" Error

This usually means the pooler hostname is incorrect. Different Supabase regions use different prefixes (aws-0, aws-1, etc.).

**Solution**: Copy the exact hostname from your Supabase Session Pooler connection string

### "pg_dump: error: aborting because of server version mismatch"

This occurs when the pg_dump client version is older than the PostgreSQL server version.

Example error:
```
pg_dump: server version: 17.6; pg_dump version: 16.11
```

**Solution**: The Docker image uses PostgreSQL 17 client from Alpine edge repository. If you see this error, ensure you're using the latest server Dockerfile which installs `postgresql17-client`.

---

## Security Considerations

1. **Private Bucket**: Never make the backup bucket public
2. **Encryption**: Enable server-side encryption (SSE-S3 or SSE-KMS)
3. **Access Keys**: Use dedicated IAM credentials for backups if possible
4. **Token Security**: Keep `BACKUP_SECRET_TOKEN` confidential
5. **Password Security**: Never commit `SUPABASE_DB_PASSWORD` to version control
6. **Network**: The backup API endpoints are rate-limited

---

## File Reference

| File | Purpose |
|------|---------|
| `server/src/services/backup.ts` | Core backup logic (pg_dump, S3 upload) |
| `server/src/routes/backup.ts` | API endpoints for backups |
| `server/Dockerfile` | Backend container with PostgreSQL 17 client |
| `src/pages/admin/Backups.tsx` | Admin UI for managing backups |
| `src/services/backup.ts` | Frontend service for backup API |
| `scripts/docker-pre-build-backup.sh` | Script run during Docker build |
| `Dockerfile` | Stage 0 runs pre-build backup |
| `docker-compose.yml` | Environment variable configuration |

---

## Requirements

- **PostgreSQL Client**: Version 17+ (must match or exceed Supabase server version)
- **Supabase**: Session Pooler connection (for IPv4 support)
- **AWS S3**: Private bucket with appropriate IAM permissions
- **Docker**: Multi-stage build support
