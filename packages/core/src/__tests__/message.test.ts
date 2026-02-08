import { createMessage, serializeMessage, parseMessage, generateNonce } from '../message';
import { SIWAMessage } from '../types';

describe('SIWA Message', () => {
  const testAddress = 'DRpbCBMxVnDK7maPM5tGv6MvB3v1sRMC86PZ8okm21hy';
  
  describe('generateNonce', () => {
    it('should generate a nonce of default length', () => {
      const nonce = generateNonce();
      expect(nonce).toHaveLength(16);
    });

    it('should generate a nonce of specified length', () => {
      const nonce = generateNonce(32);
      expect(nonce).toHaveLength(32);
    });

    it('should generate unique nonces', () => {
      const nonces = new Set(Array.from({ length: 100 }, () => generateNonce()));
      expect(nonces.size).toBe(100);
    });
  });

  describe('createMessage', () => {
    it('should create a message with defaults', () => {
      const message = createMessage({
        domain: 'example.com',
        address: testAddress,
        uri: 'https://example.com/auth',
      });

      expect(message.domain).toBe('example.com');
      expect(message.address).toBe(testAddress);
      expect(message.uri).toBe('https://example.com/auth');
      expect(message.version).toBe('1');
      expect(message.chainId).toBe('mainnet-beta');
      expect(message.nonce).toBeDefined();
      expect(message.issuedAt).toBeDefined();
      expect(message.expirationTime).toBeDefined();
    });

    it('should accept custom parameters', () => {
      const message = createMessage({
        domain: 'example.com',
        address: testAddress,
        uri: 'https://example.com/auth',
        chainId: 'devnet',
        statement: 'Custom statement',
        nonce: 'customnonce123',
        expirationMinutes: 10,
        requestId: 'req-123',
        resources: ['https://api.example.com'],
      });

      expect(message.chainId).toBe('devnet');
      expect(message.statement).toBe('Custom statement');
      expect(message.nonce).toBe('customnonce123');
      expect(message.requestId).toBe('req-123');
      expect(message.resources).toEqual(['https://api.example.com']);
    });
  });

  describe('serializeMessage', () => {
    it('should serialize a basic message', () => {
      const message: SIWAMessage = {
        domain: 'example.com',
        address: testAddress,
        uri: 'https://example.com/auth',
        version: '1',
        chainId: 'mainnet-beta',
        nonce: 'abc123',
        issuedAt: '2026-02-01T12:00:00.000Z',
      };

      const text = serializeMessage(message);

      expect(text).toContain('example.com wants you to sign in with your Solana account:');
      expect(text).toContain(testAddress);
      expect(text).toContain('URI: https://example.com/auth');
      expect(text).toContain('Version: 1');
      expect(text).toContain('Chain ID: mainnet-beta');
      expect(text).toContain('Nonce: abc123');
      expect(text).toContain('Issued At: 2026-02-01T12:00:00.000Z');
    });

    it('should include statement when present', () => {
      const message: SIWAMessage = {
        domain: 'example.com',
        address: testAddress,
        uri: 'https://example.com/auth',
        version: '1',
        chainId: 'mainnet-beta',
        nonce: 'abc123',
        issuedAt: '2026-02-01T12:00:00.000Z',
        statement: 'Sign in to Example App',
      };

      const text = serializeMessage(message);
      expect(text).toContain('Sign in to Example App');
    });

    it('should include resources when present', () => {
      const message: SIWAMessage = {
        domain: 'example.com',
        address: testAddress,
        uri: 'https://example.com/auth',
        version: '1',
        chainId: 'mainnet-beta',
        nonce: 'abc123',
        issuedAt: '2026-02-01T12:00:00.000Z',
        resources: ['https://api.example.com', 'https://data.example.com'],
      };

      const text = serializeMessage(message);
      expect(text).toContain('Resources:');
      expect(text).toContain('- https://api.example.com');
      expect(text).toContain('- https://data.example.com');
    });
  });

  describe('parseMessage', () => {
    it('should parse a valid message', () => {
      const message = createMessage({
        domain: 'example.com',
        address: testAddress,
        uri: 'https://example.com/auth',
        nonce: 'testnonce',
      });
      const text = serializeMessage(message);
      const parsed = parseMessage(text);

      expect(parsed.domain).toBe(message.domain);
      expect(parsed.address).toBe(message.address);
      expect(parsed.uri).toBe(message.uri);
      expect(parsed.nonce).toBe(message.nonce);
    });

    it('should throw on invalid message', () => {
      expect(() => parseMessage('invalid message')).toThrow('Invalid SIWA message');
    });

    it('should roundtrip serialize -> parse -> serialize', () => {
      const message = createMessage({
        domain: 'test.com',
        address: testAddress,
        uri: 'https://test.com/auth',
        statement: 'Test statement',
        resources: ['https://api.test.com'],
      });
      
      const text1 = serializeMessage(message);
      const parsed = parseMessage(text1);
      const text2 = serializeMessage(parsed);

      expect(text1).toBe(text2);
    });
  });
});
