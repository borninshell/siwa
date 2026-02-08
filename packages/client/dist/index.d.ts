/**
 * @siwa/client - SIWA Client for AI Agents
 *
 * Allows agents to authenticate with SIWA-enabled services.
 */
import { Keypair } from '@solana/web3.js';
import { SIWASession } from '@siwa/core';
export interface SIWAClientOptions {
    /** Agent's Solana keypair */
    keypair: Keypair;
    /** Chain ID (default: mainnet-beta) */
    chainId?: string;
    /** Custom fetch implementation */
    fetch?: typeof fetch;
}
export interface SignInOptions {
    /** Statement to include in the message */
    statement?: string;
    /** Resources/scopes to request */
    resources?: string[];
    /** Expiration time in minutes (default: 5) */
    expirationMinutes?: number;
}
export interface ChallengeResponse {
    challengeId: string;
    message: string;
    expiresAt: string;
}
export interface VerifyResponse {
    token: string;
    expiresAt: string;
    scopes?: string[];
}
/**
 * SIWA Client for AI agents
 */
export declare class SIWAClient {
    private keypair;
    private chainId;
    private fetchFn;
    constructor(options: SIWAClientOptions);
    /**
     * Get the agent's public key (address)
     */
    get address(): string;
    /**
     * Sign a message with the agent's keypair
     */
    sign(message: string): string;
    /**
     * Sign bytes using Ed25519
     */
    private signEd25519;
    /**
     * Create a signed SIWA message
     */
    createSignedMessage(params: {
        domain: string;
        uri: string;
        statement?: string;
        resources?: string[];
        nonce?: string;
    }): {
        message: string;
        signature: string;
    };
    /**
     * Sign in to a SIWA-enabled service
     *
     * @param serviceUrl - Base URL of the service (e.g., "https://api.helius.dev")
     * @param options - Sign-in options
     */
    signIn(serviceUrl: string, options?: SignInOptions): Promise<SIWASession>;
    /**
     * Create an authenticated fetch function
     */
    authenticatedFetch(session: SIWASession): typeof fetch;
}
/**
 * Create a SIWA client from a base58-encoded secret key
 */
export declare function createClient(secretKey: string, options?: Omit<SIWAClientOptions, 'keypair'>): SIWAClient;
/**
 * Create a SIWA client from a Uint8Array secret key
 */
export declare function createClientFromBytes(secretKey: Uint8Array, options?: Omit<SIWAClientOptions, 'keypair'>): SIWAClient;
export { SIWAMessage, SIWASession } from '@siwa/core';
//# sourceMappingURL=index.d.ts.map