/**
 * @siwa/server - SIWA Server Utilities
 *
 * Enables services to authenticate AI agents via SIWA.
 */
import { createMessage, serializeMessage, verify, generateNonce, isValidSolanaAddress, } from '@siwa/core';
import { createHash, randomBytes } from 'crypto';
/**
 * Simple in-memory nonce store with expiration checks
 */
class InMemoryNonceStore {
    store = new Map();
    async set(nonce, data) {
        const delay = data.expiresAt.getTime() - Date.now();
        // Don't store already-expired nonces
        if (delay <= 0) {
            return;
        }
        this.store.set(nonce, data);
        // Auto-cleanup expired nonces
        setTimeout(() => this.store.delete(nonce), delay);
    }
    async get(nonce) {
        const data = this.store.get(nonce);
        if (!data)
            return null;
        // Check expiration
        if (data.expiresAt < new Date()) {
            this.store.delete(nonce);
            return null;
        }
        return data;
    }
    async delete(nonce) {
        this.store.delete(nonce);
    }
    /** Atomically delete and return nonce data (prevents TOCTOU race) */
    async deleteAndGet(nonce) {
        const data = this.store.get(nonce);
        if (!data)
            return null;
        // Delete first (atomic in single-threaded JS)
        this.store.delete(nonce);
        // Then check expiration
        if (data.expiresAt < new Date()) {
            return null;
        }
        return data;
    }
}
/**
 * Simple in-memory session store with expiration checks
 */
class InMemorySessionStore {
    store = new Map();
    async set(token, session) {
        const delay = session.expiresAt.getTime() - Date.now();
        // Don't store already-expired sessions
        if (delay <= 0) {
            return;
        }
        this.store.set(token, session);
        // Auto-cleanup expired sessions
        setTimeout(() => this.store.delete(token), delay);
    }
    async get(token) {
        const session = this.store.get(token);
        if (!session)
            return null;
        if (session.expiresAt < new Date()) {
            this.store.delete(token);
            return null;
        }
        return session;
    }
    async delete(token) {
        this.store.delete(token);
    }
}
/**
 * Simple in-memory rate limit store with sliding window
 */
class InMemoryRateLimitStore {
    store = new Map();
    async get(key) {
        const data = this.store.get(key);
        if (!data)
            return null;
        // Check if window has expired
        if (data.expiresAt < new Date()) {
            this.store.delete(key);
            return null;
        }
        return data;
    }
    async set(key, data) {
        const delay = data.expiresAt.getTime() - Date.now();
        // Don't store already-expired data
        if (delay <= 0) {
            return;
        }
        this.store.set(key, data);
        // Auto-cleanup expired data
        setTimeout(() => this.store.delete(key), delay);
    }
    async delete(key) {
        this.store.delete(key);
    }
}
/**
 * Generate a secure session token
 */
function generateSessionToken() {
    return `siwa_${randomBytes(32).toString('base64url')}`;
}
/**
 * SIWA Server
 */
export class SIWAServer {
    domain;
    uri;
    challengeExpirationMinutes;
    sessionExpirationMinutes;
    nonceStore;
    sessionStore;
    statement;
    resources;
    rateLimitStore;
    maxRequests = 10;
    windowMinutes = 15;
    constructor(options) {
        this.domain = options.domain;
        this.uri = options.uri;
        this.challengeExpirationMinutes = options.challengeExpirationMinutes ?? 5;
        this.sessionExpirationMinutes = options.sessionExpirationMinutes ?? 60;
        this.nonceStore = options.nonceStore ?? new InMemoryNonceStore();
        this.sessionStore = options.sessionStore ?? new InMemorySessionStore();
        this.statement = options.statement;
        this.resources = options.resources;
        // Rate limiting setup
        if (options.rateLimit !== false) {
            this.rateLimitStore = options.rateLimit?.store ?? new InMemoryRateLimitStore();
            this.maxRequests = options.rateLimit?.maxRequests ?? 10;
            this.windowMinutes = options.rateLimit?.windowMinutes ?? 15;
        }
    }
    /**
     * Check rate limit for a given identifier (IP address or pubkey)
     */
    async checkRateLimit(identifier) {
        if (!this.rateLimitStore) {
            return true; // Rate limiting disabled
        }
        const now = new Date();
        const windowStart = new Date(now.getTime() - this.windowMinutes * 60 * 1000);
        const existing = await this.rateLimitStore.get(identifier);
        if (!existing) {
            // First request in window
            await this.rateLimitStore.set(identifier, {
                count: 1,
                windowStart: now,
                expiresAt: new Date(now.getTime() + this.windowMinutes * 60 * 1000),
            });
            return true;
        }
        // Check if we're still in the same window
        if (existing.windowStart >= windowStart) {
            // Same window, check count
            if (existing.count >= this.maxRequests) {
                return false; // Rate limit exceeded
            }
            // Increment count
            await this.rateLimitStore.set(identifier, {
                ...existing,
                count: existing.count + 1,
            });
            return true;
        }
        else {
            // New window started
            await this.rateLimitStore.set(identifier, {
                count: 1,
                windowStart: now,
                expiresAt: new Date(now.getTime() + this.windowMinutes * 60 * 1000),
            });
            return true;
        }
    }
    /**
     * Generate a challenge for an agent to sign
     */
    async createChallenge(pubkey, clientIdentifier) {
        // Rate limiting check
        if (this.rateLimitStore && clientIdentifier) {
            const allowed = await this.checkRateLimit(clientIdentifier);
            if (!allowed) {
                throw new Error(`Rate limit exceeded: max ${this.maxRequests} requests per ${this.windowMinutes} minutes`);
            }
        }
        // Validate pubkey
        if (!isValidSolanaAddress(pubkey)) {
            throw new Error('Invalid Solana public key');
        }
        // Generate nonce
        const nonce = generateNonce(32);
        // Create message
        const message = createMessage({
            domain: this.domain,
            address: pubkey,
            uri: this.uri,
            statement: this.statement,
            resources: this.resources,
            nonce,
            expirationMinutes: this.challengeExpirationMinutes,
        });
        const messageText = serializeMessage(message);
        const expiresAt = new Date(Date.now() + this.challengeExpirationMinutes * 60 * 1000);
        // Store nonce
        await this.nonceStore.set(nonce, {
            pubkey,
            message: messageText,
            expiresAt,
        });
        // Create challenge ID (hash of nonce)
        const challengeId = createHash('sha256').update(nonce).digest('base64url').slice(0, 16);
        return {
            challengeId: `ch_${challengeId}`,
            message: messageText,
            messageHash: createHash('sha256').update(messageText).digest('base64url'),
            expiresAt: expiresAt.toISOString(),
        };
    }
    /**
     * Verify a signed challenge and create a session
     */
    async verifyChallenge(challengeId, pubkey, signature) {
        // Validate pubkey
        if (!isValidSolanaAddress(pubkey)) {
            throw new Error('Invalid Solana public key');
        }
        // Find the challenge by trying to reconstruct the nonce
        // (In production, you'd store challengeId -> nonce mapping)
        // For MVP, we'll iterate through recent nonces
        // Actually, let's store by the message content and pubkey
        // The client sends back the signed message, so we can verify directly
        // For this implementation, we need the original message
        // Let's modify to accept the message text as well
        throw new Error('Use verifySignature instead');
    }
    /**
     * Verify a signature against the original message
     */
    async verifySignature(message, pubkey, signature) {
        // Verify the signature
        const result = await verify(message, signature, pubkey, {
            domain: this.domain,
        });
        if (!result.success) {
            throw new Error(result.error ?? 'Verification failed');
        }
        const siwaMessage = result.message;
        // ATOMIC nonce consumption to prevent TOCTOU race condition
        // Use deleteAndGet if available, otherwise fall back to get+delete
        let nonceData;
        if (this.nonceStore.deleteAndGet) {
            nonceData = await this.nonceStore.deleteAndGet(siwaMessage.nonce);
        }
        else {
            nonceData = await this.nonceStore.get(siwaMessage.nonce);
            if (nonceData) {
                await this.nonceStore.delete(siwaMessage.nonce);
            }
        }
        if (!nonceData) {
            throw new Error('Invalid or expired nonce');
        }
        // Verify pubkey matches
        if (nonceData.pubkey !== pubkey) {
            throw new Error('Public key mismatch');
        }
        // Create session
        const token = generateSessionToken();
        const expiresAt = new Date(Date.now() + this.sessionExpirationMinutes * 60 * 1000);
        const sessionData = {
            address: pubkey,
            expiresAt,
            scopes: siwaMessage.resources,
            message: siwaMessage,
        };
        await this.sessionStore.set(token, sessionData);
        return {
            token,
            address: pubkey,
            expiresAt: expiresAt.toISOString(),
            scopes: siwaMessage.resources,
        };
    }
    /**
     * Validate a session token
     */
    async validateSession(token) {
        return this.sessionStore.get(token);
    }
    /**
     * Revoke a session
     */
    async revokeSession(token) {
        await this.sessionStore.delete(token);
    }
    /**
     * Express-style middleware for rate limiting
     */
    rateLimitMiddleware() {
        return async (req, res, next) => {
            if (!this.rateLimitStore) {
                return next(); // Rate limiting disabled
            }
            // Use IP address as identifier
            const identifier = req.ip || req.connection.remoteAddress || 'unknown';
            try {
                const allowed = await this.checkRateLimit(identifier);
                if (!allowed) {
                    return res.status(429).json({
                        error: `Rate limit exceeded: max ${this.maxRequests} requests per ${this.windowMinutes} minutes`,
                        retryAfter: this.windowMinutes * 60,
                    });
                }
                next();
            }
            catch (error) {
                res.status(500).json({ error: 'Rate limiting error' });
            }
        };
    }
    /**
     * Express-style middleware for protected routes
     */
    middleware(options) {
        const required = options?.required ?? true;
        return async (req, res, next) => {
            const authHeader = req.headers.authorization;
            if (!authHeader) {
                if (required) {
                    return res.status(401).json({ error: 'Authorization header required' });
                }
                return next();
            }
            const [type, token] = authHeader.split(' ');
            if (type !== 'Bearer' || !token) {
                return res.status(401).json({ error: 'Invalid authorization header' });
            }
            const session = await this.validateSession(token);
            if (!session) {
                if (required) {
                    return res.status(401).json({ error: 'Invalid or expired session' });
                }
                return next();
            }
            // Attach session to request
            req.siwaSession = session;
            req.agentAddress = session.address;
            next();
        };
    }
}
// Re-export Redis stores (optional)
export { RedisSessionStore, RedisNonceStore, RedisRateLimitStore, createRedisStores, } from './redis.js';
//# sourceMappingURL=index.js.map