// Create fresh credentials for the isolated, loopback-only documentation stack.
const { randomBytes, createHmac } = require('node:crypto');
const { writeFileSync } = require('node:fs');
const { resolve } = require('node:path');
const secret = randomBytes(32).toString('hex');
const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
const token = role => {
  const now = Math.floor(Date.now() / 1000);
  const body = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ role, iss: 'supabase', iat: now, exp: now + 315360000 })}`;
  return `${body}.${createHmac('sha256', secret).update(body).digest('base64url')}`;
};
const values = {
  ROOST_DOMAIN: 'localhost', LOCAL_ORIGIN: 'http://127.0.0.1:15489', LOCAL_HTTP_PORT: '15489', LOCAL_MAIL_PORT: '15490', APP_NAME: 'Roost',
  POSTGRES_PASSWORD: randomBytes(24).toString('hex'), JWT_SECRET: secret,
  ANON_KEY: token('anon'), SERVICE_ROLE_KEY: token('service_role'),
  SECRET_KEY_BASE: randomBytes(48).toString('hex'), BACKUP_SECRET_TOKEN: randomBytes(32).toString('hex'),
  MINIO_ROOT_USER: 'roostlocal', MINIO_ROOT_PASSWORD: randomBytes(24).toString('hex'),
  MINIO_BUCKET: 'roost-local', AWS_S3_BUCKET: 'roost-local', AWS_BACKUP_BUCKET: 'roost-local-backups', AWS_REGION: 'us-east-1',
  STRIPE_ENABLED: 'false', VITE_DEMO_MODE: 'false', VITE_ENABLE_SIGNUP: 'true', GOTRUE_DISABLE_SIGNUP: 'false', GOTRUE_AUTOCONFIRM: 'true',
  SMTP_FROM_EMAIL: 'hello@roost.example', LOCAL_ADMIN_PASSWORD: randomBytes(24).toString('base64url'),
};
const destination = resolve(__dirname, '../.env.screenshots.local');
// Never overwrite credentials for an existing installation.
writeFileSync(destination, Object.entries(values).map(([key, value]) => `${key}=${value}`).join('\n') + '\n', { flag: 'wx', mode: 0o600 });
console.log('Created ignored .env.screenshots.local. Keep this file private.');
