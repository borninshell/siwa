/**
 * @siwa/client - SIWA Client for AI Agents
 *
 * Allows agents to authenticate with SIWA-enabled services.
 */
import { Keypair } from '@solana/web3.js';
import { createMessage, serializeMessage } from '@siwa/core';
import bs58 from 'bs58';
import nacl from 'tweetnacl';
/**
 * SIWA Client for AI agents
 */
export class SIWAClient {
    keypair;
    chainId;
    fetchFn;
    constructor(options) {
        this.keypair = options.keypair;
        this.chainId = options.chainId ?? 'mainnet-beta';
        this.fetchFn = options.fetch ?? fetch;
    }
    /**
     * Get the agent's public key (address)
     */
    get address() {
        return this.keypair.publicKey.toBase58();
    }
    /**
     * Sign a message with the agent's keypair
     */
    sign(message) {
        const messageBytes = new TextEncoder().encode(message);
        const signature = this.keypair.secretKey.slice(0, 32); // Ed25519 private key
        // Use nacl-like signing
        // In practice, we'd use tweetnacl or @noble/ed25519
        // For now, use the keypair's sign method via web3.js workaround
        const signatureBytes = this.signEd25519(messageBytes);
        return bs58.encode(signatureBytes);
    }
    /**
     * Sign bytes using Ed25519
     */
    signEd25519(message) {
        return nacl.sign.detached(message, this.keypair.secretKey);
    }
    /**
     * Create a signed SIWA message
     */
    createSignedMessage(params) {
        const siwaMessage = createMessage({
            domain: params.domain,
            address: this.address,
            uri: params.uri,
            chainId: this.chainId,
            statement: params.statement,
            resources: params.resources,
            nonce: params.nonce,
        });
        const messageText = serializeMessage(siwaMessage);
        const signature = this.sign(messageText);
        return { message: messageText, signature };
    }
    /**
     * Sign in to a SIWA-enabled service
     *
     * @param serviceUrl - Base URL of the service (e.g., "https://api.helius.dev")
     * @param options - Sign-in options
     */
    async signIn(serviceUrl, options) {
        const baseUrl = serviceUrl.replace(/\/$/, '');
        // 1. Request challenge
        const challengeRes = await this.fetchFn(`${baseUrl}/siwa/challenge?pubkey=${this.address}`, { method: 'GET' });
        if (!challengeRes.ok) {
            const error = await challengeRes.text();
            throw new Error(`Failed to get challenge: ${error}`);
        }
        const challenge = await challengeRes.json();
        // 2. Sign the challenge message
        const signature = this.sign(challenge.message);
        // 3. Verify with the service
        const verifyRes = await this.fetchFn(`${baseUrl}/siwa/verify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: challenge.message,
                pubkey: this.address,
                signature,
            }),
        });
        if (!verifyRes.ok) {
            const error = await verifyRes.text();
            throw new Error(`Verification failed: ${error}`);
        }
        const result = await verifyRes.json();
        return {
            token: result.token,
            address: this.address,
            expiresAt: result.expiresAt,
            scopes: result.scopes,
        };
    }
    /**
     * Create an authenticated fetch function
     */
    authenticatedFetch(session) {
        return async (input, init) => {
            const headers = new Headers(init?.headers);
            headers.set('Authorization', `Bearer ${session.token}`);
            return this.fetchFn(input, {
                ...init,
                headers,
            });
        };
    }
}
/**
 * Create a SIWA client from a base58-encoded secret key
 */
export function createClient(secretKey, options) {
    const keypair = Keypair.fromSecretKey(bs58.decode(secretKey));
    return new SIWAClient({ ...options, keypair });
}
/**
 * Create a SIWA client from a Uint8Array secret key
 */
export function createClientFromBytes(secretKey, options) {
    const keypair = Keypair.fromSecretKey(secretKey);
    return new SIWAClient({ ...options, keypair });
}
//# sourceMappingURL=index.js.map