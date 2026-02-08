import nacl from 'tweetnacl';
import bs58 from 'bs58';
import { verify, verifySignatureOnly, isValidSolanaAddress } from '../verify';
import { createMessage, serializeMessage } from '../message';

describe('SIWA Verification', () => {
  // Generate a test keypair
  const keypair = nacl.sign.keyPair();
  const publicKeyBase58 = bs58.encode(keypair.publicKey);

  const createTestMessage = (expirationMinutes = 5): string => {
    const message = createMessage({
      domain: 'test.example.com',
      address: publicKeyBase58,
      uri: 'https://test.example.com/auth',
      statement: 'Test sign in',
      nonce: 'testnonce123',
      expirationMinutes,
    });
    return serializeMessage(message);
  };

  const signMessage = (message: string): string => {
    const messageBytes = new TextEncoder().encode(message);
    const signature = nacl.sign.detached(messageBytes, keypair.secretKey);
    return bs58.encode(signature);
  };

  describe('isValidSolanaAddress', () => {
    it('should return true for valid addresses', () => {
      expect(isValidSolanaAddress(publicKeyBase58)).toBe(true);
      expect(isValidSolanaAddress('DRpbCBMxVnDK7maPM5tGv6MvB3v1sRMC86PZ8okm21hy')).toBe(true);
    });

    it('should return false for invalid addresses', () => {
      expect(isValidSolanaAddress('invalid')).toBe(false);
      expect(isValidSolanaAddress('')).toBe(false);
      expect(isValidSolanaAddress('0x1234567890abcdef')).toBe(false);
    });
  });

  describe('verify', () => {
    it('should verify a valid signature', async () => {
      const messageText = createTestMessage();
      const signature = signMessage(messageText);

      const result = await verify(messageText, signature, publicKeyBase58, {
        skipTimeCheck: true, // Skip for deterministic testing
      });

      expect(result.success).toBe(true);
      expect(result.message?.address).toBe(publicKeyBase58);
    });

    it('should reject an invalid signature', async () => {
      const messageText = createTestMessage();
      const invalidSignature = bs58.encode(nacl.randomBytes(64));

      const result = await verify(messageText, invalidSignature, publicKeyBase58, {
        skipTimeCheck: true,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Signature verification failed');
    });

    it('should reject when public key does not match address', async () => {
      const messageText = createTestMessage();
      const signature = signMessage(messageText);
      
      const differentKeypair = nacl.sign.keyPair();
      const differentPublicKey = bs58.encode(differentKeypair.publicKey);

      const result = await verify(messageText, signature, differentPublicKey, {
        skipTimeCheck: true,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('does not match');
    });

    it('should reject tampered message', async () => {
      const messageText = createTestMessage();
      const signature = signMessage(messageText);
      
      const tamperedMessage = messageText.replace('Test sign in', 'Hacked');

      const result = await verify(tamperedMessage, signature, publicKeyBase58, {
        skipTimeCheck: true,
      });

      expect(result.success).toBe(false);
    });

    it('should validate domain when specified', async () => {
      const messageText = createTestMessage();
      const signature = signMessage(messageText);

      const result = await verify(messageText, signature, publicKeyBase58, {
        domain: 'wrong.domain.com',
        skipTimeCheck: true,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Domain mismatch');
    });

    it('should validate nonce when specified', async () => {
      const messageText = createTestMessage();
      const signature = signMessage(messageText);

      const result = await verify(messageText, signature, publicKeyBase58, {
        nonce: 'wrongnonce',
        skipTimeCheck: true,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Nonce mismatch');
    });

    it('should handle malformed signature gracefully', async () => {
      const messageText = createTestMessage();
      
      const result = await verify(messageText, 'not-valid!!!', publicKeyBase58, {
        skipTimeCheck: true,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('verifySignatureOnly', () => {
    it('should verify a valid signature without parsing', async () => {
      const message = 'Simple test message';
      const messageBytes = new TextEncoder().encode(message);
      const signature = nacl.sign.detached(messageBytes, keypair.secretKey);
      const signatureBase58 = bs58.encode(signature);

      const result = await verifySignatureOnly(message, signatureBase58, publicKeyBase58);
      expect(result).toBe(true);
    });

    it('should reject invalid signature', async () => {
      const message = 'Simple test message';
      const invalidSig = bs58.encode(nacl.randomBytes(64));

      const result = await verifySignatureOnly(message, invalidSig, publicKeyBase58);
      expect(result).toBe(false);
    });

    it('should accept Uint8Array inputs', async () => {
      const message = new TextEncoder().encode('Test message');
      const signature = nacl.sign.detached(message, keypair.secretKey);

      const result = await verifySignatureOnly(message, signature, keypair.publicKey);
      expect(result).toBe(true);
    });
  });
});
