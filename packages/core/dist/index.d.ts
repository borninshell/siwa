/**
 * @siwa/core - Sign In With Agent Core Library
 *
 * Wallet-based authentication for AI agents.
 */
export type { SIWAMessage, SIWAVerificationResult, SIWAChallenge, SIWASession, } from './types.js';
export { generateNonce, createMessage, serializeMessage, parseMessage, validateTiming, } from './message.js';
export { isValidSolanaAddress, verify, verifySignatureOnly, } from './verify.js';
export declare const SIWA_VERSION = "0.1.0";
//# sourceMappingURL=index.d.ts.map