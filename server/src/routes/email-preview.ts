import { Router, Request, Response } from 'express';

const router = Router();

// Only enable in development
const isDev = process.env.NODE_ENV !== 'production';

// HTML escape function
function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Sample data for previews
const sampleData = {
  name: 'John Doe',
  email: 'john.doe@example.com',
  productName: "Roost Pro",
  variantName: 'Annual Subscription',
  resetUrl: 'https://your-domain.com/reset-password?token=sample-token-123',
  frontendUrl: 'https://your-domain.com',
  gracePeriodEnds: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
};

/**
 * GET /api/email-preview
 * List all available email templates
 */
router.get('/', (req: Request, res: Response) => {
  if (!isDev) {
    return res.status(404).json({ error: 'Not found' });
  }

  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Email Template Previews</title>
      <style>
        body { font-family: system-ui, sans-serif; max-width: 600px; margin: 40px auto; padding: 20px; }
        h1 { color: #333; }
        ul { list-style: none; padding: 0; }
        li { margin: 10px 0; }
        a { color: #667eea; text-decoration: none; font-size: 18px; }
        a:hover { text-decoration: underline; }
      </style>
    </head>
    <body>
      <h1>Email Template Previews</h1>
      <ul>
        <li><a href="/api/email-preview/welcome">Welcome Email</a></li>
        <li><a href="/api/email-preview/password-reset">Password Reset Email</a></li>
        <li><a href="/api/email-preview/subscription-cancelled">Subscription Cancelled Email</a></li>
        <li><a href="/api/email-preview/subscription-reactivated">Subscription Reactivated Email</a></li>
      </ul>
    </body>
    </html>
  `);
});

/**
 * GET /api/email-preview/welcome
 * Preview welcome email template
 */
router.get('/welcome', (req: Request, res: Response) => {
  if (!isDev) {
    return res.status(404).json({ error: 'Not found' });
  }

  const safeName = escapeHtml(sampleData.name);
  const safeProductName = escapeHtml(sampleData.productName);
  const safeEmail = escapeHtml(sampleData.email);
  const planType = escapeHtml(sampleData.variantName);
  const resetPasswordUrl = sampleData.resetUrl;
  const frontendUrl = sampleData.frontendUrl;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to Roost</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: #667eea; padding: 40px 20px; text-align: center; border-radius: 12px 12px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 28px;">Welcome to Roost!</h1>
  </div>

  <div style="background: #ffffff; padding: 40px 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
    <p style="font-size: 18px; margin-top: 0;">Hi ${safeName},</p>

    <p>Thank you for purchasing <strong>${safeProductName}</strong> (${planType})! Your account has been created and you're ready to join our community.</p>

    <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 24px 0;">
      <p style="margin: 0 0 8px 0; font-weight: 600;">Your account details:</p>
      <p style="margin: 0;">Email: <strong>${safeEmail}</strong></p>
    </div>

    <p>To get started, please set your password by clicking the button below:</p>

    <div style="text-align: center; margin: 32px 0;">
      <a href="${resetPasswordUrl}" style="display: inline-block; background: #667eea; color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">Set Your Password</a>
    </div>

    <p style="color: #6b7280; font-size: 14px;">This link will expire in 24 hours. If you didn't make this purchase, please ignore this email.</p>

    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 32px 0;">

    <p style="margin-bottom: 0;">Once you've set your password, you can:</p>
    <ul style="margin-top: 8px;">
      <li>Access all community content and discussions</li>
      <li>Connect with other members</li>
      <li>Participate in events and activities</li>
    </ul>

    <p>We're excited to have you! If you have any questions, feel free to reach out.</p>

    <p style="margin-bottom: 0;">Best,<br><strong>The Roost Team</strong></p>
  </div>

  <div style="text-align: center; padding: 20px; color: #9ca3af; font-size: 12px;">
    <p style="margin: 0;">&copy; ${new Date().getFullYear()} Roost. All rights reserved.</p>
    <p style="margin: 8px 0 0 0;">
      <a href="${frontendUrl}" style="color: #6b7280;">Visit our platform</a>
    </p>
  </div>
</body>
</html>
  `;

  res.send(html);
});

/**
 * GET /api/email-preview/password-reset
 * Preview password reset email template
 */
router.get('/password-reset', (req: Request, res: Response) => {
  if (!isDev) {
    return res.status(404).json({ error: 'Not found' });
  }

  const safeName = escapeHtml(sampleData.name);
  const safeEmail = escapeHtml(sampleData.email);
  const resetUrl = sampleData.resetUrl;
  const frontendUrl = sampleData.frontendUrl;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Your Password</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: #667eea; padding: 40px 20px; text-align: center; border-radius: 12px 12px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 28px;">Reset Your Password</h1>
  </div>

  <div style="background: #ffffff; padding: 40px 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
    <p style="font-size: 18px; margin-top: 0;">Hi ${safeName},</p>

    <p>We received a request to reset the password for your Roost account associated with <strong>${safeEmail}</strong>.</p>

    <p>Click the button below to reset your password:</p>

    <div style="text-align: center; margin: 32px 0;">
      <a href="${resetUrl}" style="display: inline-block; background: #667eea; color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">Reset Password</a>
    </div>

    <p style="color: #6b7280; font-size: 14px;">This link will expire in <strong>1 hour</strong>. If you didn't request a password reset, you can safely ignore this email - your password will remain unchanged.</p>

    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 32px 0;">

    <p style="color: #9ca3af; font-size: 13px; margin-bottom: 0;">
      If the button doesn't work, copy and paste this link into your browser:<br>
      <a href="${resetUrl}" style="color: #667eea; word-break: break-all;">${resetUrl}</a>
    </p>
  </div>

  <div style="text-align: center; padding: 20px; color: #9ca3af; font-size: 12px;">
    <p style="margin: 0;">&copy; ${new Date().getFullYear()} Roost. All rights reserved.</p>
    <p style="margin: 8px 0 0 0;">
      <a href="${frontendUrl}" style="color: #6b7280;">Visit our platform</a>
    </p>
  </div>
</body>
</html>
  `;

  res.send(html);
});

/**
 * GET /api/email-preview/subscription-cancelled
 * Preview subscription cancelled email template
 */
router.get('/subscription-cancelled', (req: Request, res: Response) => {
  if (!isDev) {
    return res.status(404).json({ error: 'Not found' });
  }

  const safeName = escapeHtml(sampleData.name);
  const safeProductName = escapeHtml(sampleData.productName);
  const formattedDate = sampleData.gracePeriodEnds.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: #f59e0b; padding: 30px 20px; text-align: center; border-radius: 12px 12px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 24px;">Subscription Cancelled</h1>
  </div>

  <div style="background: #ffffff; padding: 40px 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
    <p style="font-size: 18px; margin-top: 0;">Hi ${safeName},</p>

    <p>We're sorry to see you go! Your <strong>${safeProductName}</strong> subscription has been cancelled.</p>

    <div style="background: #fef3c7; padding: 20px; border-radius: 8px; margin: 24px 0; border-left: 4px solid #f59e0b;">
      <p style="margin: 0; font-weight: 600;">Good news: You still have access!</p>
      <p style="margin: 8px 0 0 0;">Your access continues until <strong>${formattedDate}</strong> (7-day grace period).</p>
    </div>

    <p>If you change your mind, you can reactivate your subscription anytime from your account settings.</p>

    <p style="margin-bottom: 0;">Best,<br><strong>The Roost Team</strong></p>
  </div>
</body>
</html>
  `;

  res.send(html);
});

/**
 * GET /api/email-preview/subscription-reactivated
 * Preview subscription reactivated email template
 */
router.get('/subscription-reactivated', (req: Request, res: Response) => {
  if (!isDev) {
    return res.status(404).json({ error: 'Not found' });
  }

  const safeName = escapeHtml(sampleData.name);
  const safeProductName = escapeHtml(sampleData.productName);
  const frontendUrl = sampleData.frontendUrl;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: #10b981; padding: 30px 20px; text-align: center; border-radius: 12px 12px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 24px;">Welcome Back!</h1>
  </div>

  <div style="background: #ffffff; padding: 40px 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
    <p style="font-size: 18px; margin-top: 0;">Hi ${safeName},</p>

    <p>Great news! Your <strong>${safeProductName}</strong> subscription has been reactivated.</p>

    <p>You now have full access to all community features again. We're glad to have you back!</p>

    <div style="text-align: center; margin: 32px 0;">
      <a href="${frontendUrl}" style="display: inline-block; background: #10b981; color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">Go to Community</a>
    </div>

    <p style="margin-bottom: 0;">Best,<br><strong>The Roost Team</strong></p>
  </div>
</body>
</html>
  `;

  res.send(html);
});

export default router;
