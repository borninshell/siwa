/**
 * Redis-backed stores for SIWA Server
 *
 * Provides persistent storage for sessions, nonces, and rate limiting
 * using Redis. Useful for production deployments and multi-instance setups.
 */
import { SessionStore, SessionData, NonceStore, NonceData, RateLimitStore, RateLimitData } from './index.js';
/**
 * Redis client interface (compatible with node-redis, ioredis, etc.)
 */
export interface RedisClient {
    get(key: string): Promise<string | null>;
    set(key: string, value: string, mode?: string, duration?: number): Promise<string | null>;
    setex(key: string, seconds: number, value: string): Promise<string | null>;
    del(key: string): Promise<number>;
    exists(key: string): Promise<number>;
    incr(key: string): Promise<number>;
    expire(key: string, seconds: number): Promise<number>;
}
/**
 * Redis session store with automatic expiration
 */
export declare class RedisSessionStore implements SessionStore {
    private client;
    private keyPrefix;
    constructor(client: RedisClient, options?: {
        keyPrefix?: string;
    });
    private getKey;
    set(token: string, session: SessionData): Promise<void>;
    get(token: string): Promise<SessionData | null>;
    delete(token: string): Promise<void>;
}
/**
 * Redis nonce store with atomic consume operation
 */
export declare class RedisNonceStore implements NonceStore {
    private client;
    private keyPrefix;
    constructor(client: RedisClient, options?: {
        keyPrefix?: string;
    });
    private getKey;
    set(nonce: string, data: NonceData): Promise<void>;
    get(nonce: string): Promise<NonceData | null>;
    delete(nonce: string): Promise<void>;
    /**
     * Atomically consume a nonce (delete and return)
     * This prevents TOCTOU race conditions in concurrent environments
     */
    deleteAndGet(nonce: string): Promise<NonceData | null>;
}
/**
 * Redis rate limiter using sliding window counter
 */
export declare class RedisRateLimitStore implements RateLimitStore {
    private client;
    private keyPrefix;
    constructor(client: RedisClient, options?: {
        keyPrefix?: string;
    });
    private getKey;
    get(identifier: string): Promise<RateLimitData | null>;
    set(identifier: string, data: RateLimitData): Promise<void>;
    delete(identifier: string): Promise<void>;
    /**
     * Atomic increment with sliding window logic
     * More efficient than get/set for rate limiting
     */
    increment(identifier: string, windowMinutes: number, maxRequests: number): Promise<{
        allowed: boolean;
        count: number;
        resetTime: Date;
    }>;
}
/**
 * Helper function to create Redis-backed SIWA server options
 */
export declare function createRedisStores(client: RedisClient, options?: {
    sessionKeyPrefix?: string;
    nonceKeyPrefix?: string;
    rateLimitKeyPrefix?: string;
}): {
    sessionStore: RedisSessionStore;
    nonceStore: RedisNonceStore;
    rateLimit: {
        store: RedisRateLimitStore;
    };
};
//# sourceMappingURL=redis.d.ts.map