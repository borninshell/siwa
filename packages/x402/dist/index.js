/**
 * @siwa/x402 — Authenticated Micropayments for AI Agents
 *
 * Combines SIWA wallet-based auth with x402 USDC payments.
 * Agents authenticate once, then pay-per-call for premium endpoints.
 *
 * Built by The Shellborn Collective
 * https://shellborn.io
 */
import { PublicKey, Connection, Transaction } from '@solana/web3.js';
import { getAssociatedTokenAddress, createTransferInstruction, TOKEN_PROGRAM_ID, } from '@solana/spl-token';
// ─── Constants ───────────────────────────────────────────────────────────────
/** USDC mint on Solana mainnet */
export const USDC_MINT_MAINNET = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
/** USDC mint on Solana devnet */
export const USDC_MINT_DEVNET = new PublicKey('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU');
/** x402 Payment Required header */
export const X402_HEADER = 'x-payment';
/** x402 Payment Requirements header */
export const X402_REQUIREMENTS_HEADER = 'x-payment-required';
/** USDC has 6 decimals */
export const USDC_DECIMALS = 6;
const paymentSessions = new Map();
// ─── x402 Middleware Factory ─────────────────────────────────────────────────
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
export function createX402Middleware(options) {
    const { treasury, pricePerRequest, network = 'devnet', rpcEndpoint = network === 'mainnet-beta'
        ? 'https://api.mainnet-beta.solana.com'
        : 'https://api.devnet.solana.com', priceFunction, verifyOnChain = false, } = options;
    const connection = new Connection(rpcEndpoint, 'confirmed');
    const usdcMint = network === 'mainnet-beta' ? USDC_MINT_MAINNET : USDC_MINT_DEVNET;
    return async function x402Middleware(req, res, next) {
        // Require SIWA authentication first
        if (!req.agentAddress) {
            return res.status(401).json({
                error: 'Authentication required',
                message: 'This endpoint requires SIWA authentication before payment',
            });
        }
        // Calculate price
        const price = priceFunction ? priceFunction(req) : pricePerRequest;
        // Check for payment header
        const paymentHeader = req.headers[X402_HEADER];
        if (!paymentHeader) {
            // Return 402 Payment Required with payment instructions
            const requirements = {
                payTo: treasury,
                amount: price.toFixed(USDC_DECIMALS),
                network,
                resource: req.originalUrl,
                memo: `SIWA:${req.agentAddress}:${Date.now()}`,
                expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(), // 5 min
            };
            res.setHeader(X402_REQUIREMENTS_HEADER, JSON.stringify(requirements));
            return res.status(402).json({
                error: 'Payment Required',
                message: `This endpoint requires ${price} USDC`,
                requirements,
                instructions: {
                    step1: 'Send USDC to the treasury address',
                    step2: 'Include transaction signature in x-payment header',
                    step3: 'Retry this request',
                },
            });
        }
        // Parse payment proof
        let proof;
        try {
            proof = JSON.parse(Buffer.from(paymentHeader, 'base64').toString('utf-8'));
        }
        catch {
            try {
                proof = JSON.parse(paymentHeader);
            }
            catch {
                return res.status(400).json({
                    error: 'Invalid payment header',
                    message: 'x-payment header must be valid JSON',
                });
            }
        }
        // Verify payment matches authenticated agent
        if (proof.payer !== req.agentAddress) {
            return res.status(403).json({
                error: 'Payment mismatch',
                message: 'Payment must come from authenticated agent wallet',
            });
        }
        // Verify payment amount
        if (parseFloat(proof.amount) < price) {
            return res.status(402).json({
                error: 'Insufficient payment',
                message: `Required: ${price} USDC, received: ${proof.amount} USDC`,
            });
        }
        // Optional: Verify on-chain
        if (verifyOnChain) {
            try {
                const tx = await connection.getTransaction(proof.signature, {
                    maxSupportedTransactionVersion: 0,
                });
                if (!tx) {
                    return res.status(402).json({
                        error: 'Payment not found',
                        message: 'Transaction not found on-chain. It may still be processing.',
                    });
                }
                // Basic verification - tx exists and succeeded
                if (tx.meta?.err) {
                    return res.status(402).json({
                        error: 'Payment failed',
                        message: 'Transaction failed on-chain',
                    });
                }
            }
            catch (err) {
                return res.status(500).json({
                    error: 'Verification failed',
                    message: 'Could not verify payment on-chain',
                });
            }
        }
        // Track payment in session
        let session = paymentSessions.get(req.agentAddress);
        if (!session) {
            session = {
                agentAddress: req.agentAddress,
                totalPaid: 0,
                payments: [],
                createdAt: new Date(),
            };
            paymentSessions.set(req.agentAddress, session);
        }
        session.totalPaid += parseFloat(proof.amount);
        session.payments.push(proof);
        session.lastPayment = new Date();
        // Attach proof to request
        req.paymentProof = proof;
        next();
    };
}
// ─── Client Helper: Create Payment ───────────────────────────────────────────
/**
 * Create a USDC payment transaction for x402.
 * Used by agents to pay for premium endpoints.
 */
export async function createPaymentTransaction(connection, payer, requirements) {
    const usdcMint = requirements.network === 'mainnet-beta'
        ? USDC_MINT_MAINNET
        : USDC_MINT_DEVNET;
    const payerAta = await getAssociatedTokenAddress(usdcMint, payer.publicKey);
    const treasuryPubkey = new PublicKey(requirements.payTo);
    const treasuryAta = await getAssociatedTokenAddress(usdcMint, treasuryPubkey);
    const amount = parseFloat(requirements.amount);
    const amountLamports = Math.floor(amount * Math.pow(10, USDC_DECIMALS));
    const transaction = new Transaction().add(createTransferInstruction(payerAta, treasuryAta, payer.publicKey, amountLamports, [], TOKEN_PROGRAM_ID));
    transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    transaction.feePayer = payer.publicKey;
    return { transaction, amount };
}
// ─── Client Helper: Pay and Retry ────────────────────────────────────────────
/**
 * Handle 402 response: pay and retry the request.
 * Complete x402 flow for agents.
 */
export async function payAndRetry(url, options, keypair, connection) {
    // First request - expect 402
    const res = await fetch(url, options);
    if (res.status !== 402) {
        return res; // Not a paid endpoint or already paid
    }
    // Parse requirements
    const reqHeader = res.headers.get(X402_REQUIREMENTS_HEADER);
    if (!reqHeader) {
        throw new Error('402 response missing payment requirements');
    }
    const requirements = JSON.parse(reqHeader);
    // Create and send payment
    const { transaction, amount } = await createPaymentTransaction(connection, keypair, requirements);
    transaction.sign(keypair);
    const signature = await connection.sendRawTransaction(transaction.serialize());
    // Wait for confirmation
    await connection.confirmTransaction(signature, 'confirmed');
    // Create payment proof
    const proof = {
        signature,
        payer: keypair.publicKey.toBase58(),
        amount: amount.toString(),
        timestamp: new Date().toISOString(),
    };
    // Retry with payment proof
    const retryOptions = {
        ...options,
        headers: {
            ...options.headers,
            [X402_HEADER]: Buffer.from(JSON.stringify(proof)).toString('base64'),
        },
    };
    return fetch(url, retryOptions);
}
// ─── Utilities ───────────────────────────────────────────────────────────────
/**
 * Get payment session for an agent.
 */
export function getPaymentSession(agentAddress) {
    return paymentSessions.get(agentAddress);
}
/**
 * Clear all payment sessions (for testing).
 */
export function clearPaymentSessions() {
    paymentSessions.clear();
}
export default {
    createX402Middleware,
    createPaymentTransaction,
    payAndRetry,
    getPaymentSession,
    clearPaymentSessions,
    USDC_MINT_MAINNET,
    USDC_MINT_DEVNET,
    USDC_DECIMALS,
    X402_HEADER,
    X402_REQUIREMENTS_HEADER,
};
//# sourceMappingURL=index.js.map