/**
 * End-to-end SIWA flow test
 *
 * Simulates the complete authentication flow:
 * 1. Agent requests a challenge
 * 2. Agent signs the challenge
 * 3. Server verifies the signature
 * 4. Server issues a session token
 */
import nacl from 'tweetnacl';
import bs58 from 'bs58';
import { createMessage, serializeMessage, generateNonce, verify } from '../index.js';
describe('SIWA End-to-End Flow', () => {
    // Simulate an agent's keypair
    const agentKeypair = nacl.sign.keyPair();
    const agentAddress = bs58.encode(agentKeypair.publicKey);
    // Simulate server state
    const serverDomain = 'api.helius.dev';
    const serverUri = 'https://api.helius.dev/siwa';
    const nonceStore = new Map();
    // Helper to sign a message
    const signMessage = (message) => {
        const messageBytes = new TextEncoder().encode(message);
        const signature = nacl.sign.detached(messageBytes, agentKeypair.secretKey);
        return bs58.encode(signature);
    };
    describe('Full Authentication Flow', () => {
        let challengeNonce;
        let challengeMessage;
        it('Step 1: Server creates a challenge for the agent', () => {
            // Server generates a challenge
            challengeNonce = generateNonce(32);
            const message = createMessage({
                domain: serverDomain,
                address: agentAddress,
                uri: serverUri,
                statement: 'Sign in to Helius API',
                nonce: challengeNonce,
                expirationMinutes: 5,
            });
            challengeMessage = serializeMessage(message);
            // Server stores the nonce
            nonceStore.set(challengeNonce, {
                address: agentAddress,
                message: challengeMessage,
                expiresAt: new Date(Date.now() + 5 * 60 * 1000),
            });
            expect(challengeMessage).toContain(serverDomain);
            expect(challengeMessage).toContain(agentAddress);
            expect(challengeMessage).toContain(challengeNonce);
        });
        it('Step 2: Agent signs the challenge', () => {
            const signature = signMessage(challengeMessage);
            // Signature should be 64 bytes encoded as base58
            const signatureBytes = bs58.decode(signature);
            expect(signatureBytes.length).toBe(64);
        });
        it('Step 3: Server verifies the signature', async () => {
            const signature = signMessage(challengeMessage);
            // Verify the signature
            const result = await verify(challengeMessage, signature, agentAddress, {
                domain: serverDomain,
                nonce: challengeNonce,
            });
            expect(result.success).toBe(true);
            expect(result.message?.address).toBe(agentAddress);
            expect(result.message?.domain).toBe(serverDomain);
            expect(result.message?.nonce).toBe(challengeNonce);
        });
        it('Step 4: Server issues a session token (simulated)', async () => {
            const signature = signMessage(challengeMessage);
            // Verify
            const result = await verify(challengeMessage, signature, agentAddress, {
                domain: serverDomain,
                nonce: challengeNonce,
            });
            expect(result.success).toBe(true);
            // Check nonce exists and matches
            const storedNonce = nonceStore.get(challengeNonce);
            expect(storedNonce).toBeDefined();
            expect(storedNonce?.address).toBe(agentAddress);
            // Invalidate nonce (one-time use)
            nonceStore.delete(challengeNonce);
            // Generate session token
            const sessionToken = `siwa_${bs58.encode(nacl.randomBytes(24))}`;
            const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
            expect(sessionToken).toMatch(/^siwa_/);
            expect(expiresAt.getTime()).toBeGreaterThan(Date.now());
        });
        it('Step 5: Replay attack should fail (nonce already used)', async () => {
            // Re-sign the same message
            const signature = signMessage(challengeMessage);
            // Verify signature is still cryptographically valid
            const result = await verify(challengeMessage, signature, agentAddress, {
                domain: serverDomain,
                skipTimeCheck: true,
            });
            expect(result.success).toBe(true);
            // But nonce should be gone
            const storedNonce = nonceStore.get(challengeNonce);
            expect(storedNonce).toBeUndefined();
            // Server would reject because nonce is not in store
        });
    });
    describe('Attack Scenarios', () => {
        it('should reject signature from different key', async () => {
            const attackerKeypair = nacl.sign.keyPair();
            // Create a message for the legitimate agent
            const nonce = generateNonce();
            const message = createMessage({
                domain: serverDomain,
                address: agentAddress, // Legitimate agent's address
                uri: serverUri,
                nonce,
            });
            const messageText = serializeMessage(message);
            // Attacker signs it with their key
            const attackerSig = nacl.sign.detached(new TextEncoder().encode(messageText), attackerKeypair.secretKey);
            // Try to verify with attacker's public key (won't match address in message)
            const result = await verify(messageText, bs58.encode(attackerSig), bs58.encode(attackerKeypair.publicKey), { skipTimeCheck: true });
            expect(result.success).toBe(false);
            expect(result.error).toContain('does not match');
        });
        it('should reject tampered message', async () => {
            const nonce = generateNonce();
            const message = createMessage({
                domain: serverDomain,
                address: agentAddress,
                uri: serverUri,
                statement: 'Original statement',
                nonce,
            });
            const messageText = serializeMessage(message);
            const signature = signMessage(messageText);
            // Tamper with the message
            const tamperedMessage = messageText.replace('Original statement', 'Send all funds');
            const result = await verify(tamperedMessage, signature, agentAddress, {
                skipTimeCheck: true,
            });
            expect(result.success).toBe(false);
        });
        it('should reject wrong domain', async () => {
            const nonce = generateNonce();
            const message = createMessage({
                domain: 'evil.com', // Wrong domain
                address: agentAddress,
                uri: 'https://evil.com/steal',
                nonce,
            });
            const messageText = serializeMessage(message);
            const signature = signMessage(messageText);
            const result = await verify(messageText, signature, agentAddress, {
                domain: serverDomain, // Server expects different domain
                skipTimeCheck: true,
            });
            expect(result.success).toBe(false);
            expect(result.error).toContain('Domain mismatch');
        });
    });
    describe('Multi-Agent Scenario', () => {
        it('should handle multiple agents authenticating', async () => {
            const agents = Array.from({ length: 5 }, () => {
                const keypair = nacl.sign.keyPair();
                return {
                    keypair,
                    address: bs58.encode(keypair.publicKey),
                };
            });
            const sessions = await Promise.all(agents.map(async (agent) => {
                const nonce = generateNonce();
                const message = createMessage({
                    domain: serverDomain,
                    address: agent.address,
                    uri: serverUri,
                    nonce,
                });
                const messageText = serializeMessage(message);
                const signature = bs58.encode(nacl.sign.detached(new TextEncoder().encode(messageText), agent.keypair.secretKey));
                const result = await verify(messageText, signature, agent.address, {
                    domain: serverDomain,
                    nonce,
                });
                return {
                    address: agent.address,
                    verified: result.success,
                };
            }));
            expect(sessions.every(s => s.verified)).toBe(true);
            expect(new Set(sessions.map(s => s.address)).size).toBe(5);
        });
    });
});
//# sourceMappingURL=e2e.test.js.map