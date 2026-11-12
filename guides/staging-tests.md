# Full installation tests

Run these checks against a disposable staging installation, never an existing
production community. The service scripts create test accounts and content.
The email test sends to the configured sender mailbox, which must be controlled
by the operator. A private Mailpit copy is required for automatic link checking.

The maintained scripts run inside the backend container, where dependencies and
service credentials are available. Copy each script to `/app/` first:

```bash
docker exec -e ROOST_STAGING_TESTS=true BACKEND_CONTAINER node /app/staging-smoke.cjs
docker exec -e ROOST_STAGING_TESTS=true BACKEND_CONTAINER node /app/staging-email.cjs
docker exec -e ROOST_STAGING_TESTS=true BACKEND_CONTAINER node /app/staging-realtime.cjs
docker exec -e ROOST_STAGING_TESTS=true BACKEND_CONTAINER node /app/staging-restore.cjs
docker exec -e ROOST_STAGING_TESTS=true BACKEND_CONTAINER node /app/staging-offsite.cjs
docker exec -e ROOST_STAGING_TESTS=true BACKEND_CONTAINER node /app/staging-cleanup.cjs
```

The smoke test saves disposable account credentials to
`/tmp/roost-staging-users.json` with mode 0600. Realtime uses that fixture. Keep it
private and assign it to the container's application user if copying it back
after a container rebuild. The restore check downloads the newest private backup,
restores it into a separate database, checks its data, then drops only that test
database. Use `PG_DUMP_BINARY=pg_dump15` for the bundled PostgreSQL 15 deployment.

For the offsite check, provide temporary bucket-scoped `AWS_BACKUP_*` variables
to that container command. It uploads a new backup through the real backup service,
checks anonymous object access returns 403, downloads and decompresses the object,
restores it into a separate database, and compares source/restored row counts.
The test saves a credential-free result to `/tmp/roost-offsite-report.json`.

To test a running HTTPS installation in the browser, set
`PLAYWRIGHT_BASE_URL`, `TEST_USER_EMAIL`, and `TEST_USER_PASSWORD`, then run
`npm run test:e2e`. Without a staging account, authenticated tests are explicitly
skipped. With one configured, login errors fail the tests. The suite checks
desktop/mobile layout and verifies post, reaction, and comment persistence.

Before release, run `npm run check`, build both Docker images, validate the Compose
files, and confirm delivery events with the mail provider. Remove test users,
content, private fixtures, and temporary restore data when testing is complete.

MinIO containers are built from pinned official source revisions because public
upstream image pulls are unavailable. The first build takes longer and requires
access to GitHub and the Go module proxy. MinIO and its client retain their own
upstream licenses; building them does not change Roost's license.
