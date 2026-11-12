# Backups and Recovery

Run Roost with a private database backup destination and a separate plan for uploaded files. A backup is only useful after you have verified a restore.

## Keep a copy off the app server

A bucket on the same server can help with an accidental change, but it does not protect against losing that server. For disaster recovery, use a separate S3-compatible provider or account, ideally in another region.

Roost's database backup service supports a dedicated destination:

```dotenv
AWS_BACKUP_BUCKET=your-private-backup-bucket
AWS_BACKUP_REGION=your-backup-region
AWS_BACKUP_ENDPOINT=https://your-provider-endpoint
AWS_BACKUP_ACCESS_KEY_ID=your-bucket-scoped-access-key
AWS_BACKUP_SECRET_ACCESS_KEY=your-bucket-scoped-secret
BACKUP_SECRET_TOKEN=generate-a-long-random-secret
```

Use a private bucket and restrict the access key to that bucket. Never publish these values in frontend variables, Git, screenshots, or a support ticket. Retention and deletion rules should match your own recovery requirements.

## Match the database client

Configure the direct database connection in the backend environment:

```dotenv
SUPABASE_DB_HOST=your-database-host
SUPABASE_DB_PORT=5432
SUPABASE_DB_USER=postgres
SUPABASE_DB_PASSWORD=your-database-password
PG_DUMP_BINARY=pg_dump15
```

The bundled full self-hosted stack uses PostgreSQL 15. Use the included `pg_dump15` client for that deployment. For a managed database, check its server version and choose a compatible client. The backend also includes a PostgreSQL 17 client.

## Verify backup and restore

Use a disposable staging installation to run the maintained [installation tests](./staging-tests.md). The offsite test calls the real backup service, confirms anonymous access is denied, downloads and decompresses the backup, restores it to a separate temporary database, and compares row counts.

Do not run the staging scripts against a production community. Their fixtures and cleanup routines are designed for disposable test data.

## Back up uploaded files too

Database dumps contain application records; they do not include the actual objects stored in S3 or the MinIO data volume. Configure an independent backup or replication policy for uploaded files and verify both the database and objects can be recovered together.

Store deployment environment files and recovery instructions securely outside the app server. Losing encryption/signing keys or storage credentials can complicate recovery even when a database dump exists.

## Before an update

1. Create a fresh database backup and confirm it reached the private offsite destination.
2. Confirm file-storage backups and a recent restore test are available.
3. Retain the current deployment configuration and application revision.
4. Deploy the update, then check health, sign-in, private-file access, realtime, and transactional email.

## Recovering a community

Prepare replacement infrastructure, restore the database and uploaded files, apply the matching environment configuration, and verify the application before changing DNS. Keep the previous infrastructure intact until recovery has been validated whenever it is still available.
