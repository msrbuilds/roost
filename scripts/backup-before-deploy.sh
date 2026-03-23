#!/bin/bash
# Pre-deployment backup script
# Triggers a database backup before deploying new code
# Usage: ./scripts/backup-before-deploy.sh

set -e

# Configuration
BACKEND_URL="${BACKEND_URL:-https://your-domain.com}"
BACKUP_TOKEN="${BACKUP_SECRET_TOKEN:-}"
MAX_RETRIES=3
RETRY_DELAY=5

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}=== Pre-Deployment Database Backup ===${NC}"

# Check if backup token is set
if [ -z "$BACKUP_TOKEN" ]; then
    echo -e "${RED}Error: BACKUP_SECRET_TOKEN environment variable is required${NC}"
    echo "Set it with: export BACKUP_SECRET_TOKEN=your-secret-token"
    exit 1
fi

# Function to trigger backup
trigger_backup() {
    echo "Triggering backup at ${BACKEND_URL}/api/backup/automated..."

    response=$(curl -s -w "\n%{http_code}" \
        -X POST \
        -H "Content-Type: application/json" \
        -H "x-backup-token: ${BACKUP_TOKEN}" \
        "${BACKEND_URL}/api/backup/automated" \
        --max-time 600)

    # Extract HTTP code (last line) and body (everything else)
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')

    echo "Response code: $http_code"

    if [ "$http_code" -eq 200 ]; then
        echo -e "${GREEN}Backup completed successfully!${NC}"
        echo "$body" | jq . 2>/dev/null || echo "$body"
        return 0
    else
        echo -e "${RED}Backup failed with HTTP $http_code${NC}"
        echo "$body"
        return 1
    fi
}

# Retry logic
attempt=1
while [ $attempt -le $MAX_RETRIES ]; do
    echo -e "\n${YELLOW}Attempt $attempt of $MAX_RETRIES${NC}"

    if trigger_backup; then
        echo -e "\n${GREEN}=== Backup Complete - Safe to Deploy ===${NC}"
        exit 0
    fi

    if [ $attempt -lt $MAX_RETRIES ]; then
        echo "Retrying in ${RETRY_DELAY} seconds..."
        sleep $RETRY_DELAY
    fi

    attempt=$((attempt + 1))
done

echo -e "\n${RED}=== Backup Failed After ${MAX_RETRIES} Attempts ===${NC}"
echo "You can:"
echo "  1. Check server logs for errors"
echo "  2. Manually create a backup via Supabase dashboard"
echo "  3. Proceed with deployment at your own risk"

# Exit with error to stop deployment pipeline
exit 1
