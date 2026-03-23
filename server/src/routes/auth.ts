// ============================================================
// Roost - Local Auth Routes (for MongoDB/JWT)
// These routes are only active when DB_PROVIDER=mongodb
// ============================================================

import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const router = Router();
const prisma = new PrismaClient();

const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-production';
const JWT_EXPIRES_IN = '7d';

interface JwtPayload {
  sub: string;
  email: string;
  iat: number;
  exp: number;
}

// Helper: generate tokens
function generateTokens(userId: string, email: string) {
  const access_token = jwt.sign({ sub: userId, email }, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  });
  const refresh_token = jwt.sign({ sub: userId, email, type: 'refresh' }, JWT_SECRET, {
    expiresIn: '30d',
  });
  const decoded = jwt.decode(access_token) as JwtPayload;
  return { access_token, refresh_token, expires_at: decoded.exp };
}

// Helper: generate unique username from email
async function generateUsername(email: string): Promise<string> {
  const base = email.split('@')[0].replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 20);
  let username = base;
  let counter = 1;
  while (await prisma.profile.findUnique({ where: { username } })) {
    username = `${base}${counter}`;
    counter++;
  }
  return username;
}

// POST /api/auth/signup
router.post('/signup', async (req: Request, res: Response) => {
  try {
    const { email, password, metadata } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: { message: 'Email and password required' } });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: { message: 'Password must be at least 8 characters' } });
    }

    // Check existing user
    const existing = await prisma.profile.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({ error: { message: 'Email already registered' } });
    }

    // Hash password
    const password_hash = await bcrypt.hash(password, 12);
    const username = await generateUsername(email);
    const display_name = metadata?.display_name || email.split('@')[0];

    // Create user
    const user = await prisma.profile.create({
      data: {
        email,
        password_hash,
        username,
        display_name,
        role: 'user',
        membership_type: 'free',
      },
    });

    const tokens = generateTokens(user.id, user.email);

    return res.status(201).json({
      user: {
        id: user.id,
        email: user.email,
        email_confirmed_at: new Date().toISOString(),
        created_at: user.created_at.toISOString(),
        updated_at: user.updated_at.toISOString(),
        user_metadata: { display_name: user.display_name },
      },
      session: {
        ...tokens,
        user: {
          id: user.id,
          email: user.email,
          email_confirmed_at: new Date().toISOString(),
          created_at: user.created_at.toISOString(),
          updated_at: user.updated_at.toISOString(),
        },
      },
      error: null,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Signup failed';
    return res.status(500).json({ error: { message } });
  }
});

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: { message: 'Email and password required' } });
    }

    const user = await prisma.profile.findUnique({ where: { email } });
    if (!user) {
      return res.status(401).json({ error: { message: 'Invalid credentials' } });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: { message: 'Invalid credentials' } });
    }

    // Check ban
    if (user.is_banned) {
      if (user.ban_expires_at && new Date(user.ban_expires_at) < new Date()) {
        // Ban expired, unban
        await prisma.profile.update({
          where: { id: user.id },
          data: { is_banned: false, ban_reason: null, ban_expires_at: null },
        });
      } else {
        return res.status(403).json({
          error: {
            message: 'Account banned',
            code: 'BANNED',
            details: user.ban_reason || undefined,
          },
        });
      }
    }

    // Update online status
    await prisma.profile.update({
      where: { id: user.id },
      data: { is_online: true, last_seen_at: new Date() },
    });

    const tokens = generateTokens(user.id, user.email);

    return res.json({
      user: {
        id: user.id,
        email: user.email,
        email_confirmed_at: new Date().toISOString(),
        created_at: user.created_at.toISOString(),
        updated_at: user.updated_at.toISOString(),
        user_metadata: { display_name: user.display_name },
      },
      session: {
        ...tokens,
        user: {
          id: user.id,
          email: user.email,
          email_confirmed_at: new Date().toISOString(),
          created_at: user.created_at.toISOString(),
          updated_at: user.updated_at.toISOString(),
        },
      },
      error: null,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Login failed';
    return res.status(500).json({ error: { message } });
  }
});

// POST /api/auth/logout
router.post('/logout', async (req: Request, res: Response) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (token) {
      const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
      await prisma.profile.update({
        where: { id: decoded.sub },
        data: { is_online: false, last_seen_at: new Date() },
      });
    }
    return res.json({ error: null });
  } catch {
    return res.json({ error: null }); // Logout should always succeed
  }
});

// GET /api/auth/session
router.get('/session', async (req: Request, res: Response) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.json({ user: null, session: null, error: null });
    }

    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
    const user = await prisma.profile.findUnique({ where: { id: decoded.sub } });

    if (!user) {
      return res.json({ user: null, session: null, error: { message: 'User not found' } });
    }

    return res.json({
      user: {
        id: user.id,
        email: user.email,
        email_confirmed_at: new Date().toISOString(),
        created_at: user.created_at.toISOString(),
        updated_at: user.updated_at.toISOString(),
        user_metadata: { display_name: user.display_name },
      },
      session: {
        access_token: token,
        refresh_token: '',
        expires_at: decoded.exp,
        user: {
          id: user.id,
          email: user.email,
          email_confirmed_at: new Date().toISOString(),
          created_at: user.created_at.toISOString(),
          updated_at: user.updated_at.toISOString(),
        },
      },
      error: null,
    });
  } catch {
    return res.json({ user: null, session: null, error: { message: 'Invalid token' } });
  }
});

// POST /api/auth/reset-password
router.post('/reset-password', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    // In a real implementation, send a password reset email
    // For now, just acknowledge the request
    const user = await prisma.profile.findUnique({ where: { email } });
    if (!user) {
      // Don't reveal if email exists
      return res.json({ error: null });
    }
    // TODO: Generate reset token, send email via SMTP
    return res.json({ error: null });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Reset failed';
    return res.status(500).json({ error: { message } });
  }
});

// POST /api/auth/update-password
router.post('/update-password', async (req: Request, res: Response) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: { message: 'Not authenticated' } });
    }

    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
    const { password } = req.body;

    if (!password || password.length < 8) {
      return res.status(400).json({ error: { message: 'Password must be at least 8 characters' } });
    }

    const password_hash = await bcrypt.hash(password, 12);
    await prisma.profile.update({
      where: { id: decoded.sub },
      data: { password_hash },
    });

    return res.json({ error: null });
  } catch {
    return res.status(401).json({ error: { message: 'Invalid token' } });
  }
});

// POST /api/auth/update-user
router.post('/update-user', async (req: Request, res: Response) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: { message: 'Not authenticated' } });
    }

    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
    const { email, data: metadata } = req.body;

    const updateData: Record<string, unknown> = {};
    if (email) updateData.email = email;
    if (metadata?.display_name) updateData.display_name = metadata.display_name;

    const user = await prisma.profile.update({
      where: { id: decoded.sub },
      data: updateData,
    });

    return res.json({
      user: {
        id: user.id,
        email: user.email,
        email_confirmed_at: new Date().toISOString(),
        created_at: user.created_at.toISOString(),
        updated_at: user.updated_at.toISOString(),
        user_metadata: { display_name: user.display_name },
      },
      session: null,
      error: null,
    });
  } catch {
    return res.status(401).json({ error: { message: 'Invalid token' } });
  }
});

export default router;
