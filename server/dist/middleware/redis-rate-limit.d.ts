/**
 * Redis-Backed Rate Limiting Middleware
 *
 * Provides distributed rate limiting using Redis for persistent state
 * across server restarts and multiple instances.
 */
import { Request, Response, NextFunction } from 'express';
export interface RateLimitOptions {
    windowMs: number;
    max: number;
    message?: string;
    keyGenerator?: (req: Request) => string;
    skipFailedRequests?: boolean;
    category?: string;
}
/**
 * Create a Redis-backed rate limiter middleware
 */
export declare function createRedisRateLimiter(options: RateLimitOptions): (req: Request, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
/**
 * Pre-configured rate limiters for different use cases
 */
export declare const apiRateLimiter: (req: Request, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const webhookRateLimiter: (req: Request, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
export declare function createAdminRateLimiter(): (req: Request, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const authRateLimiter: (req: Request, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
//# sourceMappingURL=redis-rate-limit.d.ts.map