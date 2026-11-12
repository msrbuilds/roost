# Brevo transactional email

Roost and Supabase Auth normally use SMTP. If you have a Brevo API key,
`docker-compose.brevo.yml` provides an optional authenticated SMTP adapter.
The adapter sends through Brevo's HTTPS API and shares Auth's private network
namespace so GoTrue can authenticate over loopback. It has no public port.

Add these values to your private deployment environment:

```dotenv
BREVO_API_KEY=your-brevo-api-key
SMTP_HOST=auth
SMTP_PORT=1025
SMTP_USER=roost
SMTP_PASS=generate-a-long-random-secret
SMTP_FROM_EMAIL=your-verified-sender@example.com
```

Authorize the server's outbound IP in Brevo and verify the sender before starting:

```bash
docker compose --env-file .env.dokploy -f docker-compose.dokploy.yml \
  -f docker-compose.brevo.yml up -d --build
```

For a direct VPS installation without Dokploy's proxy, add
`-f docker-compose.https.yml` before `up`. Point `ROOST_DOMAIN` at the server and
open ports 80 and 443; Caddy obtains and renews the HTTPS certificate. Its data
volume must be retained when rebuilding containers.

The sender address must already be verified in Brevo. Keep API keys and relay
passwords out of Git. A successful API submission means Brevo accepted the mail;
check Brevo's transactional events to confirm delivery rather than a bounce.

For staging only, `SMTP_CAPTURE_HOST` on the adapter may name an internal Mailpit
service to capture a private copy after successful API submission. Do not expose
the capture inbox publicly; confirmation links and reset tokens are sensitive.
