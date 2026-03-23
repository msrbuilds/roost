import { Router, Request, Response } from 'express';
import { supabaseAdmin } from '../lib/supabase.js';
import { z } from 'zod';

export const liveRoomRouter = Router();

// --- Auth helpers ---

function withTimeout<T>(promise: PromiseLike<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Request timeout')), ms);
    Promise.resolve(promise).then(
      (val) => { clearTimeout(timer); resolve(val); },
      (err) => { clearTimeout(timer); reject(err); },
    );
  });
}

async function authenticateUser(req: Request): Promise<string | null> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return null;

  const token = authHeader.substring(7);
  try {
    const { data: { user }, error } = await withTimeout(
      supabaseAdmin.auth.getUser(token),
      10_000 // 10 second timeout instead of hanging for 60s+
    );
    if (error || !user) return null;
    return user.id;
  } catch {
    return null;
  }
}

async function isAdmin(userId: string): Promise<boolean> {
  try {
    const { data: profile } = await withTimeout(
      supabaseAdmin
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .single(),
      10_000
    );
    return profile?.role === 'admin' || profile?.role === 'superadmin';
  } catch {
    return false;
  }
}

async function hasPremiumAccess(userId: string): Promise<boolean> {
  try {
    const { data, error } = await withTimeout(
      supabaseAdmin.rpc('has_premium_access', { p_user_id: userId }),
      10_000
    );
    if (error) {
      console.error('[LiveRoom] Premium access check error:', error);
      return false;
    }
    return data === true;
  } catch {
    return false;
  }
}

// --- Validation schemas ---

const createSessionSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  youtube_embed_url: z.string().url().optional(),
  scheduled_at: z.string().optional(),
  visibility: z.enum(['unlisted', 'private']).optional(),
});

const updateSessionSchema = z.object({
  status: z.enum(['idle', 'live', 'ended']).optional(),
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  youtube_embed_url: z.string().optional(),
  scheduled_at: z.string().optional(),
  visibility: z.enum(['unlisted', 'private']).optional(),
});

// =============================================================================
// ADMIN ENDPOINTS
// =============================================================================

/**
 * POST /api/live-room/sessions
 * Admin: Create a new live session
 */
liveRoomRouter.post('/sessions', async (req: Request, res: Response) => {
  const userId = await authenticateUser(req);
  if (!userId) return res.status(401).json({ error: 'Authentication required' });
  if (!(await isAdmin(userId))) return res.status(403).json({ error: 'Admin access required' });

  const parsed = createSessionSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid request', details: parsed.error.errors });
  }

  const { title, description, youtube_embed_url, scheduled_at, visibility } = parsed.data;

  try {
    const { data: session, error } = await supabaseAdmin
      .from('live_sessions')
      .insert({
        title,
        description: description || null,
        youtube_embed_url: youtube_embed_url || null,
        scheduled_at: scheduled_at || null,
        visibility: visibility || 'unlisted',
        status: 'idle',
        created_by: userId,
      })
      .select()
      .single();

    if (error) {
      console.error('[LiveRoom] Create session error:', error);
      return res.status(500).json({ error: 'Failed to create session' });
    }

    res.json({ session });
  } catch (error) {
    console.error('[LiveRoom] Create session error:', error);
    res.status(500).json({ error: 'Failed to create session' });
  }
});

/**
 * PUT /api/live-room/sessions/:id
 * Admin: Update session (go live, end, update details)
 */
liveRoomRouter.put('/sessions/:id', async (req: Request<{ id: string }>, res: Response) => {
  const userId = await authenticateUser(req);
  if (!userId) return res.status(401).json({ error: 'Authentication required' });
  if (!(await isAdmin(userId))) return res.status(403).json({ error: 'Admin access required' });

  const parsed = updateSessionSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid request', details: parsed.error.errors });
  }

  const sessionId = req.params.id;
  const updates: Record<string, unknown> = {};

  if (parsed.data.title) updates.title = parsed.data.title;
  if (parsed.data.description !== undefined) updates.description = parsed.data.description;
  if (parsed.data.youtube_embed_url !== undefined) {
    updates.youtube_embed_url = parsed.data.youtube_embed_url || null;
  }
  if (parsed.data.scheduled_at !== undefined) {
    updates.scheduled_at = parsed.data.scheduled_at || null;
  }
  if (parsed.data.visibility) {
    updates.visibility = parsed.data.visibility;
  }

  if (parsed.data.status) {
    updates.status = parsed.data.status;

    if (parsed.data.status === 'live') {
      updates.started_at = new Date().toISOString();
      updates.ended_at = null;
    } else if (parsed.data.status === 'ended') {
      updates.ended_at = new Date().toISOString();
    }
  }

  try {
    const { data: session, error } = await supabaseAdmin
      .from('live_sessions')
      .update(updates)
      .eq('id', sessionId)
      .select()
      .single();

    if (error) {
      console.error('[LiveRoom] Update session error:', error);
      return res.status(500).json({ error: 'Failed to update session' });
    }

    res.json({ session });
  } catch (error) {
    console.error('[LiveRoom] Update session error:', error);
    res.status(500).json({ error: 'Failed to update session' });
  }
});

/**
 * DELETE /api/live-room/sessions/:id
 * Admin: Delete a session
 */
liveRoomRouter.delete('/sessions/:id', async (req: Request<{ id: string }>, res: Response) => {
  const userId = await authenticateUser(req);
  if (!userId) return res.status(401).json({ error: 'Authentication required' });
  if (!(await isAdmin(userId))) return res.status(403).json({ error: 'Admin access required' });

  try {
    const { error } = await supabaseAdmin
      .from('live_sessions')
      .delete()
      .eq('id', req.params.id);

    if (error) {
      console.error('[LiveRoom] Delete session error:', error);
      return res.status(500).json({ error: 'Failed to delete session' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('[LiveRoom] Delete session error:', error);
    res.status(500).json({ error: 'Failed to delete session' });
  }
});

/**
 * GET /api/live-room/sessions
 * Admin: List all sessions
 */
liveRoomRouter.get('/sessions', async (req: Request, res: Response) => {
  const userId = await authenticateUser(req);
  if (!userId) return res.status(401).json({ error: 'Authentication required' });
  if (!(await isAdmin(userId))) return res.status(403).json({ error: 'Admin access required' });

  try {
    const { data: sessions, error } = await supabaseAdmin
      .from('live_sessions')
      .select('*, profiles:created_by(display_name, avatar_url)')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[LiveRoom] List sessions error:', error);
      return res.status(500).json({ error: 'Failed to list sessions' });
    }

    res.json({ sessions });
  } catch (error) {
    console.error('[LiveRoom] List sessions error:', error);
    res.status(500).json({ error: 'Failed to list sessions' });
  }
});

/**
 * GET /api/live-room/sessions/:id/rsvp-list
 * Admin: Get RSVP list with emails for a session
 */
liveRoomRouter.get('/sessions/:id/rsvp-list', async (req: Request<{ id: string }>, res: Response) => {
  const userId = await authenticateUser(req);
  if (!userId) return res.status(401).json({ error: 'Authentication required' });
  if (!(await isAdmin(userId))) return res.status(403).json({ error: 'Admin access required' });

  try {
    const { data: rsvps, error } = await supabaseAdmin
      .from('live_session_rsvps')
      .select('id, email, display_name, created_at')
      .eq('session_id', req.params.id)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('[LiveRoom] RSVP list error:', error);
      return res.status(500).json({ error: 'Failed to get RSVP list' });
    }

    res.json({ rsvps: rsvps || [] });
  } catch (error) {
    console.error('[LiveRoom] RSVP list error:', error);
    res.status(500).json({ error: 'Failed to get RSVP list' });
  }
});

// =============================================================================
// PREMIUM USER ENDPOINTS
// =============================================================================

/**
 * GET /api/live-room/status
 * Premium: Get current live status + player URL
 */
liveRoomRouter.get('/status', async (req: Request, res: Response) => {
  const userId = await authenticateUser(req);
  if (!userId) return res.status(401).json({ error: 'Authentication required' });

  const hasAccess = await hasPremiumAccess(userId) || await isAdmin(userId);
  if (!hasAccess) return res.status(403).json({ error: 'Premium access required' });

  try {
    const { data: liveSession } = await supabaseAdmin
      .from('live_sessions')
      .select('*')
      .eq('status', 'live')
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!liveSession) {
      return res.json({
        isLive: false,
        session: null,
        playerUrl: null,
        visibility: null,
      });
    }

    res.json({
      isLive: true,
      session: {
        id: liveSession.id,
        title: liveSession.title,
        description: liveSession.description,
        started_at: liveSession.started_at,
      },
      playerUrl: liveSession.youtube_embed_url || null,
      visibility: liveSession.visibility || 'unlisted',
    });
  } catch (error) {
    console.error('[LiveRoom] Status error:', error);
    res.status(500).json({ error: 'Failed to get live status' });
  }
});

/**
 * GET /api/live-room/recordings
 * Premium: List past recordings (ended sessions with YouTube URLs)
 */
liveRoomRouter.get('/recordings', async (req: Request, res: Response) => {
  const userId = await authenticateUser(req);
  if (!userId) return res.status(401).json({ error: 'Authentication required' });

  const hasAccess = await hasPremiumAccess(userId) || await isAdmin(userId);
  if (!hasAccess) return res.status(403).json({ error: 'Premium access required' });

  try {
    const { data: sessions, error } = await supabaseAdmin
      .from('live_sessions')
      .select('*')
      .eq('status', 'ended')
      .order('ended_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('[LiveRoom] List recordings error:', error);
      return res.status(500).json({ error: 'Failed to list recordings' });
    }

    const recordings = (sessions || []).map((session) => ({
      id: session.id,
      title: session.title,
      description: session.description,
      started_at: session.started_at,
      ended_at: session.ended_at,
      playerUrl: session.youtube_embed_url || null,
      visibility: session.visibility || 'unlisted',
    }));

    res.json({ recordings });
  } catch (error) {
    console.error('[LiveRoom] List recordings error:', error);
    res.status(500).json({ error: 'Failed to list recordings' });
  }
});

/**
 * GET /api/live-room/upcoming
 * Premium: Get upcoming sessions (idle, with scheduled_at in the future)
 */
liveRoomRouter.get('/upcoming', async (req: Request, res: Response) => {
  const userId = await authenticateUser(req);
  if (!userId) return res.status(401).json({ error: 'Authentication required' });

  const hasAccess = await hasPremiumAccess(userId) || await isAdmin(userId);
  if (!hasAccess) return res.status(403).json({ error: 'Premium access required' });

  try {
    const { data: sessions, error } = await supabaseAdmin
      .from('live_sessions')
      .select('id, title, description, scheduled_at, created_at')
      .eq('status', 'idle')
      .not('scheduled_at', 'is', null)
      .gte('scheduled_at', new Date().toISOString())
      .order('scheduled_at', { ascending: true });

    if (error) {
      console.error('[LiveRoom] Upcoming sessions error:', error);
      return res.status(500).json({ error: 'Failed to get upcoming sessions' });
    }

    res.json({ sessions: sessions || [] });
  } catch (error) {
    console.error('[LiveRoom] Upcoming sessions error:', error);
    res.status(500).json({ error: 'Failed to get upcoming sessions' });
  }
});

// =============================================================================
// RSVP ENDPOINTS
// =============================================================================

/**
 * POST /api/live-room/sessions/:id/rsvp
 * Premium: RSVP for a session (closes 1 hour before scheduled time)
 */
liveRoomRouter.post('/sessions/:id/rsvp', async (req: Request<{ id: string }>, res: Response) => {
  const userId = await authenticateUser(req);
  if (!userId) return res.status(401).json({ error: 'Authentication required' });

  const hasAccess = await hasPremiumAccess(userId) || await isAdmin(userId);
  if (!hasAccess) return res.status(403).json({ error: 'Premium access required' });

  try {
    // Get session to check RSVP eligibility
    const { data: session } = await supabaseAdmin
      .from('live_sessions')
      .select('id, status, scheduled_at')
      .eq('id', req.params.id)
      .single();

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (session.status === 'ended') {
      return res.status(400).json({ error: 'Session has already ended' });
    }

    // Check 1-hour cutoff before scheduled time
    if (session.scheduled_at) {
      const scheduledTime = new Date(session.scheduled_at).getTime();
      const cutoffTime = scheduledTime - 60 * 60 * 1000;
      if (Date.now() > cutoffTime) {
        return res.status(400).json({ error: 'RSVP has closed (1 hour before the session)' });
      }
    }

    // Get user email and display name
    const { data: { user } } = await supabaseAdmin.auth.admin.getUserById(userId);
    if (!user?.email) {
      return res.status(400).json({ error: 'User email not found' });
    }

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('display_name')
      .eq('id', userId)
      .single();

    // Insert RSVP
    const { error } = await supabaseAdmin
      .from('live_session_rsvps')
      .upsert({
        session_id: req.params.id,
        user_id: userId,
        email: user.email,
        display_name: profile?.display_name || null,
      }, { onConflict: 'session_id,user_id' });

    if (error) {
      console.error('[LiveRoom] RSVP error:', error);
      return res.status(500).json({ error: 'Failed to RSVP' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('[LiveRoom] RSVP error:', error);
    res.status(500).json({ error: 'Failed to RSVP' });
  }
});

/**
 * DELETE /api/live-room/sessions/:id/rsvp
 * Premium: Cancel RSVP
 */
liveRoomRouter.delete('/sessions/:id/rsvp', async (req: Request<{ id: string }>, res: Response) => {
  const userId = await authenticateUser(req);
  if (!userId) return res.status(401).json({ error: 'Authentication required' });

  try {
    const { error } = await supabaseAdmin
      .from('live_session_rsvps')
      .delete()
      .eq('session_id', req.params.id)
      .eq('user_id', userId);

    if (error) {
      console.error('[LiveRoom] Cancel RSVP error:', error);
      return res.status(500).json({ error: 'Failed to cancel RSVP' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('[LiveRoom] Cancel RSVP error:', error);
    res.status(500).json({ error: 'Failed to cancel RSVP' });
  }
});

/**
 * GET /api/live-room/sessions/:id/rsvp
 * Premium: Check if current user has RSVP'd
 */
liveRoomRouter.get('/sessions/:id/rsvp', async (req: Request<{ id: string }>, res: Response) => {
  const userId = await authenticateUser(req);
  if (!userId) return res.status(401).json({ error: 'Authentication required' });

  try {
    const { data: rsvp } = await supabaseAdmin
      .from('live_session_rsvps')
      .select('id, created_at')
      .eq('session_id', req.params.id)
      .eq('user_id', userId)
      .maybeSingle();

    res.json({ hasRsvp: !!rsvp, rsvp });
  } catch (error) {
    console.error('[LiveRoom] Check RSVP error:', error);
    res.status(500).json({ error: 'Failed to check RSVP status' });
  }
});
