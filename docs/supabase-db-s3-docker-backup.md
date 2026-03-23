# Database Backup System for Supabase + Docker

A complete guide for setting up automated PostgreSQL database backups from Supabase to AWS S3, with pre-deployment triggers and an admin UI.

## Overview

This backup system provides:
- **Automated pre-deployment backups** - Triggers before every Docker build
- **Manual backups** - Via Admin Dashboard or API
- **Secure storage** - Private S3 bucket (separate from public uploads)
- **Retention policy** - Keeps the last 30 backups automatically
- **Compression** - Gzip compression for efficient storage
- **Download functionality** - Pre-signed URLs for secure downloads

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Git Push      │────▶│  CI/CD Build     │────▶│  Docker Build   │
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
3. **Docker** deployment environment
4. **Node.js** backend server

---

## Step 1: Create a Private S3 Bucket

### Via AWS Console

1. Go to **S3** → **Create bucket**
2. **Bucket name**: `your-project-backups`
3. **AWS Region**: Choose your preferred region
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
  --bucket your-project-backups \
  --region us-east-1

# Block all public access
aws s3api put-public-access-block \
  --bucket your-project-backups \
  --public-access-block-configuration \
  "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"

# Enable encryption
aws s3api put-bucket-encryption \
  --bucket your-project-backups \
  --server-side-encryption-configuration \
  '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}'
```

---

## Step 2: Configure IAM Permissions

Your IAM user/role needs permissions for the backup bucket:

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
        "arn:aws:s3:::your-project-backups",
        "arn:aws:s3:::your-project-backups/*"
      ]
    }
  ]
}
```

### Option: Create a Dedicated Backup IAM User (Recommended)

1. Go to **IAM** → **Users** → **Create user**
2. User name: `your-project-backup-service`
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
postgresql://postgres.yourproject:[YOUR-PASSWORD]@aws-0-us-east-1.pooler.supabase.com:5432/postgres
```

From this, extract the **host**: `aws-0-us-east-1.pooler.supabase.com`

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

### Backend Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `AWS_BACKUP_BUCKET` | Private S3 bucket name | `your-project-backups` |
| `AWS_BACKUP_REGION` | Bucket region | `us-east-1` |
| `AWS_BACKUP_ACCESS_KEY_ID` | IAM access key | `AKIA...` |
| `AWS_BACKUP_SECRET_ACCESS_KEY` | IAM secret key | `wJalr...` |
| `SUPABASE_DB_PASSWORD` | Supabase database password | `your-db-password` |
| `SUPABASE_POOLER_HOST` | Session Pooler hostname | `aws-0-us-east-1.pooler.supabase.com` |
| `BACKUP_SECRET_TOKEN` | Secret token for automated backups | `your-random-token` |

### Build Arguments (for pre-build backups)

| Variable | Description | Example |
|----------|-------------|---------|
| `BACKUP_API_URL` | URL of your running backend | `https://your-app.com` |
| `BACKUP_SECRET_TOKEN` | Same token as above | `your-random-token` |

### Example .env File

```env
# Backup Configuration
AWS_BACKUP_BUCKET=your-project-backups
AWS_BACKUP_REGION=us-east-1
AWS_BACKUP_ACCESS_KEY_ID=your-access-key
AWS_BACKUP_SECRET_ACCESS_KEY=your-secret-key
SUPABASE_DB_PASSWORD=your-database-password
SUPABASE_POOLER_HOST=aws-0-us-east-1.pooler.supabase.com
BACKUP_SECRET_TOKEN=your-secret-token

# For pre-build backups (Docker)
BACKUP_API_URL=https://your-app.com
```

---

## Step 6: Backend Implementation

### Required Dependencies

```bash
npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
```

### Dockerfile Configuration

Your backend Dockerfile needs PostgreSQL client installed:

```dockerfile
FROM node:20-alpine AS production

# Install PostgreSQL 17 client for pg_dump
# Must match or exceed Supabase server version
RUN apk add --no-cache --repository=https://dl-cdn.alpinelinux.org/alpine/edge/main postgresql17-client && \
    echo 'precedence ::ffff:0:0/96 100' >> /etc/gai.conf
```

The `gai.conf` line configures IPv4 preference, which fixes connection issues with Supabase pooler in Docker environments.

---

## Usage

### Automatic Backups (Pre-Deployment)

Backups are triggered automatically during Docker builds:

1. You push code to your Git repository
2. CI/CD detects the change and starts a build
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
curl -X POST https://your-app.com/api/backup/trigger \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**With Backup Token (for scripts/cron):**

```bash
curl -X POST https://your-app.com/api/backup/automated \
  -H "x-backup-token: YOUR_BACKUP_SECRET_TOKEN"
```

### List Backups (API)

```bash
curl https://your-app.com/api/backup/list \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

## Restoring from Backup

### Download the Backup

```bash
# List available backups
aws s3 ls s3://your-project-backups/backups/

# Download a specific backup
aws s3 cp s3://your-project-backups/backups/backup-2024-01-15T10-30-00-000Z.sql.gz ./backup.sql.gz

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

- **Maximum backups**: 30 (configurable)
- **Cleanup**: Oldest backups are deleted when the limit is exceeded
- **Frequency**: With daily deployments, this provides ~1 month of backup history

To change the retention policy, modify `MAX_BACKUPS` in the backup service.

---

## Troubleshooting

### Backup Fails with "AWS_BACKUP_BUCKET environment variable is required"

Ensure `AWS_BACKUP_BUCKET` is set in your environment variables.

### Backup Fails with "SUPABASE_URL and SUPABASE_DB_PASSWORD required"

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
3. Extract the hostname (e.g., `aws-0-us-east-1.pooler.supabase.com`)
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

**Solution**: Install PostgreSQL 17 client from Alpine edge repository:
```dockerfile
RUN apk add --no-cache --repository=https://dl-cdn.alpinelinux.org/alpine/edge/main postgresql17-client
```

---

## Security Considerations

1. **Private Bucket**: Never make the backup bucket public
2. **Encryption**: Enable server-side encryption (SSE-S3 or SSE-KMS)
3. **Access Keys**: Use dedicated IAM credentials for backups if possible
4. **Token Security**: Keep `BACKUP_SECRET_TOKEN` confidential
5. **Password Security**: Never commit database passwords to version control
6. **Network**: The backup API endpoints should be rate-limited
7. **Download URLs**: Pre-signed URLs expire after 15 minutes

---

## Requirements

- **PostgreSQL Client**: Version 17+ (must match or exceed Supabase server version)
- **Supabase**: Session Pooler connection (for IPv4 support)
- **AWS S3**: Private bucket with appropriate IAM permissions
- **Docker**: Multi-stage build support
- **Node.js**: Backend server with Express

---

## API Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/backup/trigger` | JWT (Admin) | Trigger manual backup |
| POST | `/api/backup/automated` | x-backup-token | Trigger automated backup |
| GET | `/api/backup/list` | JWT (Admin) | List all backups |
| GET | `/api/backup/download/:filename` | JWT (Admin) | Get pre-signed download URL |

---

## License

This implementation is provided as-is for educational purposes. Adapt it to your specific needs and security requirements.
