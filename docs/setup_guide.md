# Complete Setup Guide

This guide walks you through setting up all integrations required for the Roost community platform.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Supabase Setup](#supabase-setup)
3. [AWS S3 Setup](#aws-s3-setup)
4. [Gumroad Setup](#gumroad-setup)
5. [Environment Variables](#environment-variables)
6. [Running the Application](#running-the-application)
7. [Troubleshooting](#troubleshooting)

---

## Prerequisites

Before starting, ensure you have:

- **Node.js 18+** installed ([Download](https://nodejs.org/))
- A **Supabase account** ([Sign up](https://supabase.com))
- An **AWS account** ([Sign up](https://aws.amazon.com))
- A **Gumroad account** (optional, for membership sales) ([Sign up](https://gumroad.com))

---

## Supabase Setup

Supabase provides authentication, database, and real-time features.

### Step 1: Create a Supabase Project

1. Go to [https://app.supabase.com](https://app.supabase.com)
2. Click **New Project**
3. Fill in:
   - **Organization**: Select or create one
   - **Project name**: `roost` (or your preferred name)
   - **Database password**: Save this securely!
   - **Region**: Choose closest to your users
4. Click **Create new project**
5. Wait for the project to initialize (~2 minutes)

### Step 2: Get Your API Credentials

1. In your project dashboard, go to **Settings** → **API**
2. Copy these values:

| Setting | Description | Environment Variable |
|---------|-------------|---------------------|
| **Project URL** | `https://[project-id].supabase.co` | `VITE_SUPABASE_URL` |
| **anon public** key | Public API key for client-side | `VITE_SUPABASE_ANON_KEY` |
| **service_role** key | Secret key for server-side only | `SUPABASE_SERVICE_ROLE_KEY` |

> ⚠️ **Security Warning**: Never expose the `service_role` key in client-side code!

### Step 3: Run Database Migrations

1. In Supabase, go to **SQL Editor**
2. Run the migration files in order:

**Migration 1: Initial Schema**
- Open `/migrations/001_initial_schema.sql`
- Copy the entire contents
- Paste into SQL Editor and click **Run**

**Migration 2: RLS Policies**
- Open `/migrations/002_rls_policies.sql`
- Copy and run

**Migration 3: Functions & Triggers**
- Open `/migrations/003_functions_triggers.sql`
- Copy and run

**Migration 4: Gumroad Integration** (optional)
- Open `/migrations/004_gumroad_integration.sql`
- Copy and run

You should see success messages after each migration.

### Step 4: Configure Authentication

1. Go to **Authentication** → **Providers**
2. **Email** is enabled by default
3. Configure email templates (optional):
   - Go to **Authentication** → **Email Templates**
   - Customize confirmation, password reset, etc.

### Step 5: Enable Realtime (Optional)

For real-time features like live notifications:

1. Go to **Database** → **Replication**
2. Enable replication for tables you want real-time updates:
   - `messages`
   - `notifications`
   - `posts`
   - `comments`

---

## AWS S3 Setup

AWS S3 is used for storing uploaded files (images, videos, documents).

### Step 1: Create an S3 Bucket

1. Go to [AWS S3 Console](https://console.aws.amazon.com/s3/)
2. Click **Create bucket**
3. Configure:
   - **Bucket name**: `roost-uploads` (must be globally unique)
   - **Region**: Choose closest to your users (e.g., `us-east-1`)
   - **Object Ownership**: ACLs disabled
   - **Block Public Access**: 
     - ✅ Uncheck "Block all public access" (for public files)
     - Acknowledge the warning
   - **Bucket Versioning**: Disabled (optional)
   - **Encryption**: SSE-S3 (default)
4. Click **Create bucket**

### Step 2: Configure Bucket Policy (Public Read)

1. Select your bucket
2. Go to **Permissions** tab
3. Edit **Bucket policy** and add:

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "PublicReadGetObject",
            "Effect": "Allow",
            "Principal": "*",
            "Action": "s3:GetObject",
            "Resource": "arn:aws:s3:::YOUR-BUCKET-NAME/*"
        }
    ]
}
```

> Replace `YOUR-BUCKET-NAME` with your actual bucket name.

### Step 3: Configure CORS

1. In **Permissions** tab, scroll to **Cross-origin resource sharing (CORS)**
2. Click **Edit** and add:

```json
[
    {
        "AllowedHeaders": ["*"],
        "AllowedMethods": ["GET", "PUT", "POST", "DELETE", "HEAD"],
        "AllowedOrigins": [
            "http://localhost:3000",
            "https://yourdomain.com"
        ],
        "ExposeHeaders": ["ETag"]
    }
]
```

> Add your production domain to `AllowedOrigins`.

### Step 4: Create IAM User for App Access

1. Go to [AWS IAM Console](https://console.aws.amazon.com/iam/)
2. Click **Users** → **Create user**
3. Configure:
   - **User name**: `roost-app`
   - **Access type**: Programmatic access only
4. Click **Next: Permissions**
5. Choose **Attach policies directly**
6. Click **Create policy** and use this JSON:

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "s3:PutObject",
                "s3:GetObject",
                "s3:DeleteObject",
                "s3:ListBucket"
            ],
            "Resource": [
                "arn:aws:s3:::YOUR-BUCKET-NAME",
                "arn:aws:s3:::YOUR-BUCKET-NAME/*"
            ]
        }
    ]
}
```

7. Name the policy: `RoostS3Access`
8. Attach this policy to your user
9. Click **Create user**
10. **Download or copy** the Access Key ID and Secret Access Key

> ⚠️ This is the only time you can see the secret key!

---

## Gumroad Setup

Gumroad handles membership sales and subscriptions.

### Step 1: Create a Product

1. Go to [Gumroad Dashboard](https://app.gumroad.com/products)
2. Click **New Product**
3. Configure:
   - **Type**: Membership
   - **Name**: Your community membership name
   - **Price**: Your membership price
   - **Billing**: Monthly/Yearly
4. Publish the product

### Step 2: Get API Access Token

1. Go to [Gumroad Settings → Advanced](https://app.gumroad.com/settings/advanced)
2. Under **API**, find your **Access Token**
3. Copy and save it securely

### Step 3: Configure Ping Webhook

1. In Gumroad Settings → Advanced
2. Find **Ping** section
3. Set **Ping URL** to:
   ```
   https://yourdomain.com/api/webhooks/gumroad?token=YOUR_WEBHOOK_TOKEN
   ```
4. Enable all events you want to track:
   - ✅ Sale
   - ✅ Refund
   - ✅ Subscription updated
   - ✅ Subscription ended
   - ✅ Subscription restarted

### Step 4: Map Products to Groups (In Database)

After creating products, add mappings to the database:

```sql
INSERT INTO gumroad_products (gumroad_product_id, product_name, group_id, is_active)
VALUES 
  ('your-gumroad-product-id', 'Premium Membership', 'your-group-uuid', true);
```

Find your Gumroad product ID:
1. Go to your product page
2. The URL contains the ID: `gumroad.com/l/PRODUCT_ID`

---

## Environment Variables

Create a `.env.local` file in the project root:

```bash
cp .env.example .env.local
```

Fill in all values:

```env
# =============================================================================
# SUPABASE CONFIGURATION
# =============================================================================
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Server-side only (for webhooks)
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# =============================================================================
# AWS S3 CONFIGURATION
# =============================================================================
VITE_AWS_REGION=us-east-1
VITE_AWS_S3_BUCKET=roost-uploads
# AWS credentials are server-side only (never use VITE_ for secrets)
AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY

# =============================================================================
# GUMROAD CONFIGURATION (Optional)
# =============================================================================
GUMROAD_ACCESS_TOKEN=your-gumroad-access-token
GUMROAD_WEBHOOK_TOKEN=your-webhook-token

# =============================================================================
# APPLICATION CONFIGURATION
# =============================================================================
VITE_APP_NAME=Roost
VITE_APP_URL=http://localhost:3000
```

---

## Running the Application

### Development Mode

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

The app will run at: [http://localhost:3000](http://localhost:3000)

### Production Build

```bash
# Build for production
npm run build

# Preview production build
npm run preview
```

---

## Testing the Setup

### 1. Test Supabase Connection

1. Open the app in your browser
2. Try to sign up with an email
3. Check Supabase Dashboard → Authentication → Users

### 2. Test S3 Upload

1. After logging in, try to upload an avatar
2. Check your S3 bucket for the uploaded file

### 3. Test Gumroad Webhook

Use Gumroad's test ping feature:

1. Go to Gumroad Settings → Advanced
2. Click **Send Test Ping**
3. Check your server logs for the webhook payload

---

## Troubleshooting

### Supabase Issues

**"Missing Supabase environment variables"**
- Ensure `.env.local` exists and has correct values
- Restart the dev server after changing `.env.local`

**"Permission denied" errors**
- Check RLS policies are correctly applied
- Ensure migrations ran successfully

**Users can't sign up**
- Check email confirmation settings in Supabase
- Verify SMTP is configured (or disable email confirmation for testing)

### S3 Issues

**"Access Denied" when uploading**
- Verify IAM user has correct permissions
- Check bucket CORS configuration
- Ensure access keys are correct

**Files not publicly accessible**
- Check bucket policy allows public read
- Verify "Block Public Access" is disabled

### Gumroad Issues

**Webhook not receiving events**
- Verify ping URL is correct and publicly accessible
- Check server logs for incoming requests
- Ensure HTTPS is used in production

**Users not being created**
- Check webhook handler is implemented
- Verify Supabase service role key is set
- Check Gumroad product is mapped to a group

---

## Quick Reference

### URLs

| Service | Dashboard URL |
|---------|--------------|
| Supabase | https://app.supabase.com |
| AWS S3 | https://console.aws.amazon.com/s3 |
| AWS IAM | https://console.aws.amazon.com/iam |
| Gumroad | https://app.gumroad.com |

### Environment Variable Checklist

| Variable | Required | Where to Find |
|----------|----------|---------------|
| `VITE_SUPABASE_URL` | ✅ Yes | Supabase → Settings → API |
| `VITE_SUPABASE_ANON_KEY` | ✅ Yes | Supabase → Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | For webhooks | Supabase → Settings → API |
| `VITE_AWS_REGION` | ✅ Yes | AWS region code (e.g., us-east-1) |
| `VITE_AWS_S3_BUCKET` | ✅ Yes | Your S3 bucket name |
| `AWS_ACCESS_KEY_ID` | For uploads/backups | IAM → Users → Security credentials |
| `AWS_SECRET_ACCESS_KEY` | For uploads/backups | IAM → Users → Security credentials |
| `GUMROAD_ACCESS_TOKEN` | Optional | Gumroad → Settings → Advanced |

---

## Next Steps

After completing setup:

1. ✅ Create your first community group
2. ✅ Configure group categories
3. ✅ Set up Gumroad products (if using paid memberships)
4. ✅ Customize the UI and branding
5. ✅ Deploy to production using [Dokploy](./dokploy_deployment.md)

---

## Support

If you encounter issues:

1. Check the [troubleshooting section](#troubleshooting)
2. Review Supabase/AWS/Gumroad documentation
3. Check browser console for errors
4. Review server logs for API errors
