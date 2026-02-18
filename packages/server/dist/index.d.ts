/**
 * @siwa/server - SIWA Server Utilities
 *
 * Enables services to authenticate AI agents via SIWA.
 */
import { SIWAChallenge, SIWASession, SIWAMessage } from '@siwa/core';
export interface SIWAServerOptions {
    /** Domain name of the service */
    domain: string;
    /** Full URI of the service */
    uri: string;
    /** Challenge expiration in minutes (default: 5) */
    challengeExpirationMinutes?: number;
    /** Session expiration in minutes (default: 60) */
    sessionExpirationMinutes?: number;
    /** Custom nonce store (default: in-memory Map) */
    nonceStore?: NonceStore;
    /** Custom session store (default: in-memory Map) */
    sessionStore?: SessionStore;
    /** Statement to include in auth message */
    statement?: string;
    /** Resources/scopes to request */
    resources?: string[];
    /** Rate limiting configuration (set to false to disable) */
    rateLimit?: RateLimitOptions | false;
}
export interface RateLimitOptions {
    /** Maximum requests per window (default: 10) */
    maxRequests?: number;
    /** Window duration in minutes (default: 15) */
    windowMinutes?: number;
    /** Custom rate limit store (default: in-memory Map) */
    store?: RateLimitStore;
}
export interface RateLimitStore {
    get(key: string): Promise<RateLimitData | null>;
    set(key: string, data: RateLimitData): Promise<void>;
    delete(key: string): Promise<void>;
}
export interface RateLimitData {
    count: number;
    windowStart: Date;
    expiresAt: Date;
}
export interface NonceStore {
    set(nonce: string, data: NonceData): Promise<void>;
    get(nonce: string): Promise<NonceData | null>;
    delete(nonce: string): Promise<void>;
    /** Atomically delete and return nonce data (prevents TOCTOU race) */
    deleteAndGet?(nonce: string): Promise<NonceData | null>;
}
export interface NonceData {
    pubkey: string;
    message: string;
    expiresAt: Date;
}
export interface SessionStore {
    set(token: string, session: SessionData): Promise<void>;
    get(token: string): Promise<SessionData | null>;
    delete(token: string): Promise<void>;
}
export interface SessionData {
    address: string;
    expiresAt: Date;
    scopes?: string[];
    message?: SIWAMessage;
}
/**
 * SIWA Server
 */
export declare class SIWAServer {
    private domain;
    private uri;
    private challengeExpirationMinutes;
    private sessionExpirationMinutes;
    private nonceStore;
    private sessionStore;
    private statement?;
    private resources?;
    private rateLimitStore?;
    private maxRequests;
    private windowMinutes;
    constructor(options: SIWAServerOptions);
    /**
     * Check rate limit for a given identifier (IP address or pubkey)
     */
    checkRateLimit(identifier: string): Promise<boolean>;
    /**
     * Generate a challenge for an agent to sign
     */
    createChallenge(pubkey: string, clientIdentifier?: string): Promise<SIWAChallenge>;
    /**
     * Verify a signed challenge and create a session
     */
    verifyChallenge(challengeId: string, pubkey: string, signature: string): Promise<SIWASession>;
    /**
     * Verify a signature against the original message
     */
    verifySignature(message: string, pubkey: string, signature: string): Promise<SIWASession>;
    /**
     * Validate a session token
     */
    validateSession(token: string): Promise<SessionData | null>;
    /**
     * Revoke a session
     */
    revokeSession(token: string): Promise<void>;
    /**
     * Express-style middleware for rate limiting
     */
    rateLimitMiddleware(): (req: any, res: any, next: any) => Promise<any>;
    /**
     * Express-style middleware for protected routes
     */
    middleware(options?: {
        required?: boolean;
    }): (req: any, res: any, next: any) => Promise<any>;
}
export { SIWAMessage, SIWAChallenge, SIWASession, SIWAVerificationResult, } from '@siwa/core';
export { RedisSessionStore, RedisNonceStore, RedisRateLimitStore, createRedisStores, type RedisClient, } from './redis.js';
//# sourceMappingURL=index.d.ts.map