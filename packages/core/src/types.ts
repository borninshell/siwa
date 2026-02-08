/**
 * SIWA Core Types
 */

export interface SIWAMessage {
  /** Domain requesting authentication (e.g., "api.helius.dev") */
  domain: string;
  
  /** Agent's Solana public key (base58) */
  address: string;
  
  /** Human-readable statement (optional) */
  statement?: string;
  
  /** Full URI of the resource */
  uri: string;
  
  /** SIWA version */
  version: string;
  
  /** Solana chain ID (e.g., "mainnet-beta", "devnet") */
  chainId: string;
  
  /** Random nonce to prevent replay attacks */
  nonce: string;
  
  /** ISO 8601 timestamp when message was issued */
  issuedAt: string;
  
  /** ISO 8601 timestamp when message expires */
  expirationTime?: string;
  
  /** ISO 8601 timestamp for "not before" */
  notBefore?: string;
  
  /** Unique request ID */
  requestId?: string;
  
  /** List of resources/scopes being requested */
  resources?: string[];
}

export interface SIWAVerificationResult {
  success: boolean;
  message?: SIWAMessage;
  error?: string;
}

export interface SIWAChallenge {
  challengeId: string;
  message: string;
  messageHash: string;
  expiresAt: string;
}

export interface SIWASession {
  token: string;
  address: string;
  expiresAt: string;
  scopes?: string[];
}
