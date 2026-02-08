/**
 * @siwa/server - SIWA Server Utilities
 *
 * Enables services to authenticate AI agents via SIWA.
 */
import { createMessage, serializeMessage, verify, generateNonce, isValidSolanaAddress, } from '@siwa/core';
import { createHash, randomBytes } from 'crypto';
/**
 * Simple in-memory nonce store
 */
class InMemoryNonceStore {
    store = new Map();
    async set(nonce, data) {
        this.store.set(nonce, data);
        // Auto-cleanup expired nonces
        setTimeout(() => this.store.delete(nonce), data.expiresAt.getTime() - Date.now());
    }
    async get(nonce) {
        return this.store.get(nonce) ?? null;
    }
    async delete(nonce) {
        this.store.delete(nonce);
    }
}
/**
 * Simple in-memory session store
 */
class InMemorySessionStore {
    store = new Map();
    async set(token, session) {
        this.store.set(token, session);
        // Auto-cleanup expired sessions
        setTimeout(() => this.store.delete(token), session.expiresAt.getTime() - Date.now());
    }
    async get(token) {
        const session = this.store.get(token);
        if (session && session.expiresAt < new Date()) {
            this.store.delete(token);
            return null;
        }
        return session ?? null;
    }
    async delete(token) {
        this.store.delete(token);
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
    constructor(options) {
        this.domain = options.domain;
        this.uri = options.uri;
        this.challengeExpirationMinutes = options.challengeExpirationMinutes ?? 5;
        this.sessionExpirationMinutes = options.sessionExpirationMinutes ?? 60;
        this.nonceStore = options.nonceStore ?? new InMemoryNonceStore();
        this.sessionStore = options.sessionStore ?? new InMemorySessionStore();
        this.statement = options.statement;
        this.resources = options.resources;
    }
    /**
     * Generate a challenge for an agent to sign
     */
    async createChallenge(pubkey) {
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
        // Check nonce hasn't been used (replay protection)
        const nonceData = await this.nonceStore.get(siwaMessage.nonce);
        if (!nonceData) {
            throw new Error('Invalid or expired nonce');
        }
        // Verify pubkey matches
        if (nonceData.pubkey !== pubkey) {
            throw new Error('Public key mismatch');
        }
        // Delete nonce (one-time use)
        await this.nonceStore.delete(siwaMessage.nonce);
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
//# sourceMappingURL=index.js.map