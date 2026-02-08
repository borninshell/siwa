/**
 * @siwa/core - Sign In With Agent Core Library
 * 
 * Wallet-based authentication for AI agents.
 */

// Types
export type {
  SIWAMessage,
  SIWAVerificationResult,
  SIWAChallenge,
  SIWASession,
} from './types.js';

// Message creation and parsing
export {
  generateNonce,
  createMessage,
  serializeMessage,
  parseMessage,
  validateTiming,
} from './message.js';

// Signature verification
export {
  isValidSolanaAddress,
  verify,
  verifySignatureOnly,
} from './verify.js';

// Version
export const SIWA_VERSION = '0.1.0';
