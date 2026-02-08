/**
 * SIWA Signature Verification
 */
import { PublicKey } from '@solana/web3.js';
import { parseMessage, validateTiming } from './message.js';
import bs58 from 'bs58';
/**
 * Verify that a public key is valid Solana address
 */
export function isValidSolanaAddress(address) {
    try {
        const pubkey = new PublicKey(address);
        // Check it's a valid point on the ed25519 curve
        return PublicKey.isOnCurve(pubkey.toBytes());
    }
    catch {
        return false;
    }
}
/**
 * Verify an ed25519 signature using tweetnacl
 */
async function verifyEd25519Signature(message, signature, publicKey) {
    try {
        // Use tweetnacl for Ed25519 verification
        // Dynamic import to avoid bundling issues
        const nacl = await import('tweetnacl');
        return nacl.sign.detached.verify(message, signature, publicKey);
    }
    catch (error) {
        console.error('Ed25519 verification error:', error);
        return false;
    }
}
/**
 * Verify a SIWA signature
 *
 * @param messageText - The original message string that was signed
 * @param signature - Base58 or Base64 encoded signature
 * @param publicKey - Base58 encoded public key (Solana address)
 * @param options - Additional verification options
 */
export async function verify(messageText, signature, publicKey, options) {
    try {
        // Parse the message
        let message;
        try {
            message = parseMessage(messageText);
        }
        catch (error) {
            return {
                success: false,
                error: `Failed to parse message: ${error.message}`
            };
        }
        // Validate the public key format
        if (!isValidSolanaAddress(publicKey)) {
            return {
                success: false,
                error: 'Invalid Solana public key'
            };
        }
        // Check address matches
        if (message.address !== publicKey) {
            return {
                success: false,
                error: 'Public key does not match message address'
            };
        }
        // Check domain if specified
        if (options?.domain && message.domain !== options.domain) {
            return {
                success: false,
                error: `Domain mismatch: expected ${options.domain}, got ${message.domain}`
            };
        }
        // Check nonce if specified (replay protection)
        if (options?.nonce && message.nonce !== options.nonce) {
            return {
                success: false,
                error: 'Nonce mismatch'
            };
        }
        // Validate timing
        if (!options?.skipTimeCheck) {
            const timing = validateTiming(message);
            if (!timing.valid) {
                return {
                    success: false,
                    error: timing.error
                };
            }
        }
        // Decode signature (try base58 first, then base64)
        let signatureBytes;
        try {
            signatureBytes = bs58.decode(signature);
        }
        catch {
            try {
                signatureBytes = Uint8Array.from(Buffer.from(signature, 'base64'));
            }
            catch {
                return {
                    success: false,
                    error: 'Invalid signature encoding (expected base58 or base64)'
                };
            }
        }
        // Check signature length (ed25519 signatures are 64 bytes)
        if (signatureBytes.length !== 64) {
            return {
                success: false,
                error: `Invalid signature length: ${signatureBytes.length} (expected 64)`
            };
        }
        // Decode public key
        const publicKeyBytes = bs58.decode(publicKey);
        // Encode message as bytes
        const messageBytes = new TextEncoder().encode(messageText);
        // Verify the signature
        const isValid = await verifyEd25519Signature(messageBytes, signatureBytes, publicKeyBytes);
        if (!isValid) {
            return {
                success: false,
                error: 'Signature verification failed'
            };
        }
        return {
            success: true,
            message
        };
    }
    catch (error) {
        return {
            success: false,
            error: `Verification error: ${error.message}`
        };
    }
}
/**
 * Simple verification that just checks the signature is valid
 * (doesn't parse message or check timing)
 */
export async function verifySignatureOnly(message, signature, publicKey) {
    try {
        // Convert message to bytes
        const messageBytes = typeof message === 'string'
            ? new TextEncoder().encode(message)
            : message;
        // Convert signature to bytes
        let signatureBytes;
        if (typeof signature === 'string') {
            try {
                signatureBytes = bs58.decode(signature);
            }
            catch {
                signatureBytes = Uint8Array.from(Buffer.from(signature, 'base64'));
            }
        }
        else {
            signatureBytes = signature;
        }
        // Convert public key to bytes
        let publicKeyBytes;
        if (typeof publicKey === 'string') {
            publicKeyBytes = bs58.decode(publicKey);
        }
        else {
            publicKeyBytes = publicKey;
        }
        return await verifyEd25519Signature(messageBytes, signatureBytes, publicKeyBytes);
    }
    catch {
        return false;
    }
}
//# sourceMappingURL=verify.js.map