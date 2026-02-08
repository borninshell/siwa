/**
 * SIWA Signature Verification
 */
import { SIWAVerificationResult } from './types.js';
/**
 * Verify that a public key is valid Solana address
 */
export declare function isValidSolanaAddress(address: string): boolean;
/**
 * Verify a SIWA signature
 *
 * @param messageText - The original message string that was signed
 * @param signature - Base58 or Base64 encoded signature
 * @param publicKey - Base58 encoded public key (Solana address)
 * @param options - Additional verification options
 */
export declare function verify(messageText: string, signature: string, publicKey: string, options?: {
    /** Expected domain (if different from message) */
    domain?: string;
    /** Expected nonce (for replay protection) */
    nonce?: string;
    /** Skip timing validation */
    skipTimeCheck?: boolean;
}): Promise<SIWAVerificationResult>;
/**
 * Simple verification that just checks the signature is valid
 * (doesn't parse message or check timing)
 */
export declare function verifySignatureOnly(message: string | Uint8Array, signature: string | Uint8Array, publicKey: string | Uint8Array): Promise<boolean>;
//# sourceMappingURL=verify.d.ts.map