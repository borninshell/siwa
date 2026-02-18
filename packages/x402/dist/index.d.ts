/**
 * @siwa/x402 — Authenticated Micropayments for AI Agents
 *
 * Combines SIWA wallet-based auth with x402 USDC payments.
 * Agents authenticate once, then pay-per-call for premium endpoints.
 *
 * Built by The Shellborn Collective
 * https://shellborn.io
 */
import type { Request, Response, NextFunction } from 'express';
import { PublicKey, Connection, Keypair, Transaction } from '@solana/web3.js';
/** USDC mint on Solana mainnet */
export declare const USDC_MINT_MAINNET: PublicKey;
/** USDC mint on Solana devnet */
export declare const USDC_MINT_DEVNET: PublicKey;
/** x402 Payment Required header */
export declare const X402_HEADER = "x-payment";
/** x402 Payment Requirements header */
export declare const X402_REQUIREMENTS_HEADER = "x-payment-required";
/** USDC has 6 decimals */
export declare const USDC_DECIMALS = 6;
export interface PaymentRequirements {
    /** Recipient wallet address (base58) */
    payTo: string;
    /** Amount in USDC (human readable, e.g., "0.01") */
    amount: string;
    /** Network: 'mainnet-beta' | 'devnet' */
    network: 'mainnet-beta' | 'devnet';
    /** Resource being accessed */
    resource: string;
    /** Optional memo */
    memo?: string;
    /** Expiration timestamp */
    expiresAt: string;
}
export interface PaymentProof {
    /** Transaction signature */
    signature: string;
    /** Payer wallet address */
    payer: string;
    /** Amount paid */
    amount: string;
    /** Timestamp */
    timestamp: string;
}
export interface X402Options {
    /** Treasury wallet to receive payments */
    treasury: string;
    /** Price per request in USDC */
    pricePerRequest: number;
    /** Network */
    network?: 'mainnet-beta' | 'devnet';
    /** RPC endpoint */
    rpcEndpoint?: string;
    /** Custom price function based on endpoint */
    priceFunction?: (req: Request) => number;
    /** Verify payment on-chain (slower but secure) */
    verifyOnChain?: boolean;
}
interface PaymentSession {
    agentAddress: string;
    totalPaid: number;
    payments: PaymentProof[];
    createdAt: Date;
    lastPayment?: Date;
}
/**
 * Creates Express middleware for x402 paid endpoints.
 * Works with SIWA auth - agent must be authenticated first.
 *
 * @example
 * ```typescript
 * const x402 = createX402Middleware({
 *   treasury: 'YOUR_TREASURY_WALLET',
 *   pricePerRequest: 0.001, // $0.001 per request
 *   network: 'devnet',
 * });
 *
 * // Protected + Paid endpoint
 * app.get('/api/premium', siwa.middleware(), x402, (req, res) => {
 *   res.json({ data: 'premium content' });
 * });
 * ```
 */
export declare function createX402Middleware(options: X402Options): (req: Request & {
    agentAddress?: string;
    paymentProof?: PaymentProof;
}, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
/**
 * Create a USDC payment transaction for x402.
 * Used by agents to pay for premium endpoints.
 */
export declare function createPaymentTransaction(connection: Connection, payer: Keypair, requirements: PaymentRequirements): Promise<{
    transaction: Transaction;
    amount: number;
}>;
/**
 * Handle 402 response: pay and retry the request.
 * Complete x402 flow for agents.
 */
export declare function payAndRetry(url: string, options: RequestInit, keypair: Keypair, connection: Connection): Promise<globalThis.Response>;
/**
 * Get payment session for an agent.
 */
export declare function getPaymentSession(agentAddress: string): PaymentSession | undefined;
/**
 * Clear all payment sessions (for testing).
 */
export declare function clearPaymentSessions(): void;
declare const _default: {
    createX402Middleware: typeof createX402Middleware;
    createPaymentTransaction: typeof createPaymentTransaction;
    payAndRetry: typeof payAndRetry;
    getPaymentSession: typeof getPaymentSession;
    clearPaymentSessions: typeof clearPaymentSessions;
    USDC_MINT_MAINNET: PublicKey;
    USDC_MINT_DEVNET: PublicKey;
    USDC_DECIMALS: number;
    X402_HEADER: string;
    X402_REQUIREMENTS_HEADER: string;
};
export default _default;
//# sourceMappingURL=index.d.ts.map