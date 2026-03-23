import { Router } from 'express';
import { supabaseAdmin } from '../lib/supabase.js';
import { redisHealthCheck, isRedisAvailable } from '../lib/redis.js';

export const healthRouter = Router();

healthRouter.get('/', async (_req, res) => {
  try {
    // Check Supabase connection
    const { error } = await supabaseAdmin.from('profiles').select('count').limit(1);

    if (error) {
      throw new Error(`Supabase error: ${error.message}`);
    }

    // Check Redis connection
    const redisHealth = await redisHealthCheck();

    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        supabase: 'connected',
        redis: redisHealth.status === 'healthy'
          ? `connected (${redisHealth.latencyMs}ms)`
          : isRedisAvailable() ? 'degraded' : 'disconnected',
      },
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});
