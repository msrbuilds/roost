"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.emailService = void 0;
const nodemailer_1 = __importDefault(require("nodemailer"));
// HTML escape function to prevent XSS in email templates
function escapeHtml(unsafe) {
    return unsafe
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
class EmailService {
    transporter = null;
    fromEmail;
    fromName;
    constructor() {
        this.fromEmail = process.env.SMTP_FROM_EMAIL || 'noreply@example.com';
        this.fromName = process.env.SMTP_FROM_NAME || 'Commune';
        this.initializeTransporter();
    }
    initializeTransporter() {
        const host = process.env.SMTP_HOST;
        const port = parseInt(process.env.SMTP_PORT || '587', 10);
        const secure = process.env.SMTP_SECURE === 'true';
        const user = process.env.SMTP_USER;
        const pass = process.env.SMTP_PASS;
        if (!host || !user || !pass) {
            console.warn('SMTP configuration incomplete. Email sending disabled.');
            return;
        }
        const config = {
            host,
            port,
            secure,
            auth: { user, pass },
        };
        this.transporter = nodemailer_1.default.createTransport(config);
        // Verify SMTP connection on startup
        this.transporter.verify((error, success) => {
            if (error) {
                console.error('SMTP connection verification failed:', error.message);
            }
            else if (success) {
                console.log('SMTP connection verified successfully');
            }
        });
    }
    async sendEmail(options) {
        if (!this.transporter) {
            console.error('Email transporter not configured. Check SMTP_HOST, SMTP_USER, and SMTP_PASS environment variables.');
            return false;
        }
        try {
            await this.transporter.sendMail({
                from: `"${this.fromName}" <${this.fromEmail}>`,
                to: options.to,
                subject: options.subject,
                html: options.html,
                text: options.text,
            });
            console.log(`Email sent successfully to ${options.to}`);
            return true;
        }
        catch (error) {
            console.error('Failed to send email:', error);
            return false;
        }
    }
    async sendWelcomeEmail(params) {
        const { email, name, productName, variantName, resetPasswordUrl } = params;
        // Escape user-provided data to prevent XSS
        const safeName = escapeHtml(name || 'there');
        const safeProductName = escapeHtml(productName);
        const safeEmail = escapeHtml(email);
        const planType = escapeHtml(variantName || 'Subscription');
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
        const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to ${this.fromName}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: #667eea; padding: 40px 20px; text-align: center; border-radius: 12px 12px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 28px;">Welcome to ${this.fromName}!</h1>
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

    <p style="margin-bottom: 0;">Best,<br><strong>The ${this.fromName} Team</strong></p>
  </div>

  <div style="text-align: center; padding: 20px; color: #9ca3af; font-size: 12px;">
    <p style="margin: 0;">&copy; ${new Date().getFullYear()} ${this.fromName}. All rights reserved.</p>
    <p style="margin: 8px 0 0 0;">
      <a href="${frontendUrl}" style="color: #6b7280;">Visit our platform</a>
    </p>
  </div>
</body>
</html>
    `;
        const text = `
Welcome to ${this.fromName}!

Hi ${safeName},

Thank you for purchasing ${safeProductName} (${planType})! Your account has been created and you're ready to join our community.

Your account details:
Email: ${safeEmail}

To get started, please set your password by visiting:
${resetPasswordUrl}

This link will expire in 24 hours.

Once you've set your password, you can:
- Access all community content and discussions
- Connect with other members
- Participate in events and activities

We're excited to have you!

Best,
The ${this.fromName} Team
    `;
        return this.sendEmail({
            to: email,
            subject: `Welcome to ${this.fromName} - ${productName}`,
            html,
            text,
        });
    }
    async sendSubscriptionCancelledEmail(params) {
        const { email, name, productName, gracePeriodEnds } = params;
        // Escape user-provided data to prevent XSS
        const safeName = escapeHtml(name || 'there');
        const safeProductName = escapeHtml(productName);
        const formattedDate = gracePeriodEnds.toLocaleDateString('en-US', {
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

    <p style="margin-bottom: 0;">Best,<br><strong>The ${this.fromName} Team</strong></p>
  </div>
</body>
</html>
    `;
        return this.sendEmail({
            to: email,
            subject: `Your ${productName} subscription has been cancelled`,
            html,
        });
    }
    async sendSubscriptionReactivatedEmail(params) {
        const { email, name, productName } = params;
        // Escape user-provided data to prevent XSS
        const safeName = escapeHtml(name || 'there');
        const safeProductName = escapeHtml(productName);
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
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

    <p style="margin-bottom: 0;">Best,<br><strong>The ${this.fromName} Team</strong></p>
  </div>
</body>
</html>
    `;
        return this.sendEmail({
            to: email,
            subject: `Welcome back! Your ${productName} subscription is active`,
            html,
        });
    }
    async sendPasswordResetEmail(params) {
        const { email, name, resetUrl } = params;
        // Escape user-provided data to prevent XSS
        const safeName = escapeHtml(name || 'there');
        const safeEmail = escapeHtml(email);
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
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

    <p>We received a request to reset the password for your ${this.fromName} account associated with <strong>${safeEmail}</strong>.</p>

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
    <p style="margin: 0;">&copy; ${new Date().getFullYear()} ${this.fromName}. All rights reserved.</p>
    <p style="margin: 8px 0 0 0;">
      <a href="${frontendUrl}" style="color: #6b7280;">Visit our platform</a>
    </p>
  </div>
</body>
</html>
    `;
        const text = `
Reset Your Password

Hi ${safeName},

We received a request to reset the password for your ${this.fromName} account associated with ${safeEmail}.

Click the link below to reset your password:
${resetUrl}

This link will expire in 1 hour. If you didn't request a password reset, you can safely ignore this email - your password will remain unchanged.

Best,
The ${this.fromName} Team
    `;
        return this.sendEmail({
            to: email,
            subject: `Reset your ${this.fromName} password`,
            html,
            text,
        });
    }
    async sendNotificationEmail(params) {
        const { to, userName, notificationType, title, message, link } = params;
        const safeName = escapeHtml(userName || 'there');
        const safeTitle = escapeHtml(title);
        const safeMessage = message ? escapeHtml(message) : '';
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
        // Get notification type specific styling
        const { color, icon, subject } = this.getNotificationTypeStyles(notificationType, title);
        const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: ${color}; padding: 30px 20px; text-align: center; border-radius: 12px 12px 0 0;">
    <div style="font-size: 32px; margin-bottom: 8px;">${icon}</div>
    <h1 style="color: white; margin: 0; font-size: 22px;">${safeTitle}</h1>
  </div>

  <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
    <p style="font-size: 16px; margin-top: 0;">Hi ${safeName},</p>

    ${safeMessage ? `
    <div style="background: #f9fafb; padding: 16px; border-radius: 8px; margin: 20px 0; border-left: 4px solid ${color};">
      <p style="margin: 0; color: #4b5563; font-style: italic;">"${safeMessage}${safeMessage.length >= 100 ? '...' : ''}"</p>
    </div>
    ` : ''}

    ${link ? `
    <div style="text-align: center; margin: 24px 0;">
      <a href="${link}" style="display: inline-block; background: ${color}; color: white; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-weight: 600; font-size: 14px;">View on Platform</a>
    </div>
    ` : ''}

    <p style="color: #6b7280; font-size: 14px; margin-bottom: 0;">
      You can manage your notification preferences in your <a href="${frontendUrl}/settings" style="color: ${color};">account settings</a>.
    </p>
  </div>

  <div style="text-align: center; padding: 20px; color: #9ca3af; font-size: 12px;">
    <p style="margin: 0;">&copy; ${new Date().getFullYear()} ${this.fromName}. All rights reserved.</p>
    <p style="margin: 8px 0 0 0;">
      <a href="${frontendUrl}" style="color: #6b7280;">Visit our platform</a>
    </p>
  </div>
</body>
</html>
    `;
        const text = `
${title}

Hi ${safeName},

${message || ''}

${link ? `View on platform: ${link}` : ''}

You can manage your notification preferences in your account settings at ${frontendUrl}/settings

---
${this.fromName}
    `;
        return this.sendEmail({
            to,
            subject,
            html,
            text,
        });
    }
    async sendActivationStatusEmail(params) {
        const { email, name, productName, status, websiteUrl, adminNotes } = params;
        const safeName = escapeHtml(name || 'there');
        const safeProductName = escapeHtml(productName);
        const safeWebsiteUrl = escapeHtml(websiteUrl);
        const safeAdminNotes = adminNotes ? escapeHtml(adminNotes) : '';
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
        // Status-specific configuration
        const statusConfig = {
            pending: {
                color: '#f59e0b',
                icon: '⏳',
                title: 'Activation Request Received',
                message: `Your activation request for <strong>${safeProductName}</strong> has been received and is pending review.`,
            },
            in_progress: {
                color: '#3b82f6',
                icon: '⚙️',
                title: 'Activation In Progress',
                message: `Good news! Your <strong>${safeProductName}</strong> activation is now being processed.`,
            },
            completed: {
                color: '#10b981',
                icon: '✅',
                title: 'Activation Completed',
                message: `Great news! Your <strong>${safeProductName}</strong> has been successfully activated on your website.`,
            },
            rejected: {
                color: '#ef4444',
                icon: '❌',
                title: 'Activation Request Update',
                message: `Your <strong>${safeProductName}</strong> activation request has been reviewed.`,
            },
        };
        const config = statusConfig[status];
        const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${config.title}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: ${config.color}; padding: 30px 20px; text-align: center; border-radius: 12px 12px 0 0;">
    <div style="font-size: 40px; margin-bottom: 8px;">${config.icon}</div>
    <h1 style="color: white; margin: 0; font-size: 24px;">${config.title}</h1>
  </div>

  <div style="background: #ffffff; padding: 40px 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
    <p style="font-size: 18px; margin-top: 0;">Hi ${safeName},</p>

    <p>${config.message}</p>

    <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin: 24px 0;">
      <p style="margin: 0 0 8px 0; font-weight: 600; color: #4b5563;">Request Details:</p>
      <p style="margin: 0; color: #6b7280;">
        <strong>Product:</strong> ${safeProductName}<br>
        <strong>Website:</strong> ${safeWebsiteUrl}<br>
        <strong>Status:</strong> <span style="color: ${config.color}; font-weight: 600;">${status.replace('_', ' ').toUpperCase()}</span>
      </p>
    </div>

    ${safeAdminNotes ? `
    <div style="background: #fef3c7; padding: 16px; border-radius: 8px; margin: 24px 0; border-left: 4px solid #f59e0b;">
      <p style="margin: 0 0 8px 0; font-weight: 600; color: #92400e;">Note from our team:</p>
      <p style="margin: 0; color: #78350f;">${safeAdminNotes}</p>
    </div>
    ` : ''}

    <div style="text-align: center; margin: 32px 0;">
      <a href="${frontendUrl}/activations" style="display: inline-block; background: ${config.color}; color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">View My Activations</a>
    </div>

    <p style="margin-bottom: 0;">Best,<br><strong>The ${this.fromName} Team</strong></p>
  </div>

  <div style="text-align: center; padding: 20px; color: #9ca3af; font-size: 12px;">
    <p style="margin: 0;">&copy; ${new Date().getFullYear()} ${this.fromName}. All rights reserved.</p>
    <p style="margin: 8px 0 0 0;">
      <a href="${frontendUrl}" style="color: #6b7280;">Visit our platform</a>
    </p>
  </div>
</body>
</html>
    `;
        const text = `
${config.title}

Hi ${safeName},

${config.message.replace(/<[^>]*>/g, '')}

Request Details:
- Product: ${safeProductName}
- Website: ${safeWebsiteUrl}
- Status: ${status.replace('_', ' ').toUpperCase()}

${safeAdminNotes ? `Note from our team: ${safeAdminNotes}` : ''}

View your activations at: ${frontendUrl}/activations

Best,
The ${this.fromName} Team
    `;
        return this.sendEmail({
            to: email,
            subject: `${config.title} - ${productName}`,
            html,
            text,
        });
    }
    getNotificationTypeStyles(type, title) {
        switch (type) {
            case 'new_comment':
                return {
                    color: '#3b82f6', // blue
                    icon: '💬',
                    subject: `New Comment: ${title}`,
                };
            case 'comment_reply':
                return {
                    color: '#06b6d4', // cyan
                    icon: '↩️',
                    subject: `New Reply: ${title}`,
                };
            case 'new_reaction':
                return {
                    color: '#ef4444', // red
                    icon: '❤️',
                    subject: `New Reaction: ${title}`,
                };
            case 'new_message':
                return {
                    color: '#667eea', // primary
                    icon: '✉️',
                    subject: title,
                };
            case 'mention':
                return {
                    color: '#f97316', // orange
                    icon: '@',
                    subject: `You were mentioned: ${title}`,
                };
            case 'group_invite':
                return {
                    color: '#8b5cf6', // purple
                    icon: '👥',
                    subject: `Group Invitation: ${title}`,
                };
            case 'new_follower':
                return {
                    color: '#22c55e', // green
                    icon: '👤',
                    subject: `New Follower: ${title}`,
                };
            case 'event_reminder':
                return {
                    color: '#eab308', // yellow
                    icon: '📅',
                    subject: `Event Reminder: ${title}`,
                };
            default:
                return {
                    color: '#667eea', // primary
                    icon: '🔔',
                    subject: title,
                };
        }
    }
}
exports.emailService = new EmailService();
//# sourceMappingURL=email.js.map