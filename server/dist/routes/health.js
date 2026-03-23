"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.healthRouter = void 0;
const express_1 = require("express");
const supabase_js_1 = require("../lib/supabase.js");
const redis_js_1 = require("../lib/redis.js");
exports.healthRouter = (0, express_1.Router)();
exports.healthRouter.get('/', async (_req, res) => {
    try {
        // Check Supabase connection
        const { error } = await supabase_js_1.supabaseAdmin.from('profiles').select('count').limit(1);
        if (error) {
            throw new Error(`Supabase error: ${error.message}`);
        }
        // Check Redis connection
        const redisHealth = await (0, redis_js_1.redisHealthCheck)();
        res.json({
            status: 'healthy',
            timestamp: new Date().toISOString(),
            services: {
                supabase: 'connected',
                redis: redisHealth.status === 'healthy'
                    ? `connected (${redisHealth.latencyMs}ms)`
                    : (0, redis_js_1.isRedisAvailable)() ? 'degraded' : 'disconnected',
            },
        });
    }
    catch (error) {
        res.status(503).json({
            status: 'unhealthy',
            timestamp: new Date().toISOString(),
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});
//# sourceMappingURL=health.js.map