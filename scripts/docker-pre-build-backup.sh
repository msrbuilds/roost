#!/bin/sh
# Pre-build backup script for Docker builds
# This script is called from Dockerfile before the build starts
# It triggers a backup on the running production server

set -e

echo "=== Pre-Build Database Backup ==="

# Check required environment variables
if [ -z "$BACKUP_API_URL" ]; then
    echo "Warning: BACKUP_API_URL not set, skipping backup"
    exit 0
fi

if [ -z "$BACKUP_SECRET_TOKEN" ]; then
    echo "Warning: BACKUP_SECRET_TOKEN not set, skipping backup"
    exit 0
fi

echo "Triggering backup at ${BACKUP_API_URL}/api/backup/automated..."

# Use wget (available in Alpine) to trigger the backup
# Allow up to 10 minutes for the backup to complete
response=$(wget -q -O - \
    --header="Content-Type: application/json" \
    --header="x-backup-token: ${BACKUP_SECRET_TOKEN}" \
    --post-data="" \
    --timeout=600 \
    "${BACKUP_API_URL}/api/backup/automated" 2>&1) || {
    exit_code=$?
    echo "Warning: Backup request failed (exit code: $exit_code)"
    echo "Response: $response"
    echo "Continuing with build anyway..."
    exit 0
}

echo "Backup response: $response"

# Check if response contains success
if echo "$response" | grep -q '"success":true'; then
    echo "=== Backup completed successfully ==="
else
    echo "Warning: Backup may have failed, but continuing with build"
fi

exit 0
