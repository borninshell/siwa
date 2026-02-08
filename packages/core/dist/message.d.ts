/**
 * SIWA Message Creation and Parsing
 */
import { SIWAMessage } from './types.js';
/**
 * Generate a cryptographically secure nonce
 */
export declare function generateNonce(length?: number): string;
/**
 * Create a SIWA message object with defaults
 */
export declare function createMessage(params: {
    domain: string;
    address: string;
    uri: string;
    chainId?: string;
    statement?: string;
    nonce?: string;
    expirationMinutes?: number;
    resources?: string[];
    requestId?: string;
}): SIWAMessage;
/**
 * Serialize a SIWA message to the standard string format
 */
export declare function serializeMessage(message: SIWAMessage): string;
/**
 * Parse a SIWA message string back into a message object
 */
export declare function parseMessage(text: string): SIWAMessage;
/**
 * Validate message timing (not expired, not before)
 */
export declare function validateTiming(message: SIWAMessage): {
    valid: boolean;
    error?: string;
};
//# sourceMappingURL=message.d.ts.map