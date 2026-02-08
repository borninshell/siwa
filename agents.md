# SIWA - Agent Integration Guide

> Sign In With Agent — wallet-based authentication for autonomous AI agents.

## Quick Start

```bash
npm install @siwa/client @solana/web3.js
```

```typescript
import { SIWAClient } from '@siwa/client';
import { Keypair } from '@solana/web3.js';

// Use your agent's existing keypair
const client = new SIWAClient({
  keypair: Keypair.fromSecretKey(yourSecretKey),
});

// Authenticate with any SIWA-enabled service
const session = await client.signIn('https://api.example.com');

// Make authenticated requests
const response = await client.authenticatedFetch(session)('/api/data');
```

## How It Works

SIWA uses the same Ed25519 signatures that Solana uses for transactions. Your agent proves identity by signing a challenge message — no passwords, no API keys, no OAuth flows.

### Authentication Flow

1. **Request Challenge** — Agent sends its public key to the service
2. **Sign Message** — Agent signs the challenge with its private key
3. **Verify & Session** — Service verifies signature, issues session token
4. **Authenticated Calls** — Agent uses token for subsequent API calls

### Message Format

```
example.com wants you to sign in with your Solana account:
7xKN2vqLCfbUmJPmQK94X9BzyJ3q8zTvhd8eFAZmQ4p

Sign in to Example API

URI: https://example.com
Version: 1
Chain ID: solana:mainnet
Nonce: xK9mZ2pLqR4n
Issued At: 2026-02-08T12:00:00.000Z
Expiration Time: 2026-02-08T12:05:00.000Z
```

## Packages

| Package | Purpose | Install |
|---------|---------|---------|
| `@siwa/core` | Message parsing, verification | `npm i @siwa/core` |
| `@siwa/client` | Agent SDK with signIn() | `npm i @siwa/client` |
| `@siwa/server` | Server utilities, middleware | `npm i @siwa/server` |
| `@siwa/x402` | Micropayment integration | `npm i @siwa/x402` |

## Client API

### SIWAClient

```typescript
const client = new SIWAClient({
  keypair: Keypair,  // Your Solana keypair
});

// Full authentication flow
const session = await client.signIn(serviceUrl, {
  challengePath?: string,  // Default: '/siwa/challenge'
  verifyPath?: string,     // Default: '/siwa/verify'
});

// Returns: { token: string, expiresAt: Date }

// Make authenticated requests
const authedFetch = client.authenticatedFetch(session);
const data = await authedFetch('/api/protected');

// Sign a challenge manually
const signature = client.sign(challengeMessage);
```

### Low-Level Usage

```typescript
import { createMessage, serializeMessage, verify } from '@siwa/core';
import nacl from 'tweetnacl';
import bs58 from 'bs58';

// Create a challenge message
const message = createMessage({
  domain: 'api.example.com',
  address: publicKey.toBase58(),
  uri: 'https://api.example.com',
  nonce: generateNonce(),
  issuedAt: new Date(),
  expirationTime: new Date(Date.now() + 5 * 60 * 1000),
  statement: 'Sign in to Example API',
});

// Serialize for signing
const messageText = serializeMessage(message);

// Sign with your keypair
const messageBytes = new TextEncoder().encode(messageText);
const signatureBytes = nacl.sign.detached(messageBytes, keypair.secretKey);
const signature = bs58.encode(signatureBytes);

// Verify (service side)
const result = await verify(messageText, signature, publicKey.toBase58(), {
  domain: 'api.example.com',
});

if (result.success) {
  console.log('Authenticated:', result.message.address);
}
```

## Security Considerations

### For Agents

- **Protect your keypair** — The private key is your identity. Store it securely.
- **Verify service URLs** — Only authenticate with trusted services.
- **Check session expiry** — Re-authenticate before tokens expire.
- **Don't reuse signatures** — Each challenge should be signed once.

### For Services

- **Use one-time nonces** — Prevent replay attacks.
- **Validate timing** — Check issued/expiration timestamps.
- **Bind to domain** — Verify messages are for your domain.
- **Rate limit challenges** — Prevent DoS via nonce exhaustion.

## x402 Integration (Paid APIs)

SIWA integrates with x402 for authenticated micropayments:

```typescript
import { SIWAClient } from '@siwa/client';
import { x402Client } from '@siwa/x402';

const client = new SIWAClient({ keypair });

// Authenticate + pay in one flow
const result = await x402Client.payAndCall({
  siwa: client,
  url: 'https://api.example.com/premium',
  price: 0.001,  // USDC
  treasury: 'TreasuryPubkey...',
});
```

## Examples

### OpenClaw Agent Skill

```typescript
// As an OpenClaw skill
import { SIWAClient } from '@siwa/client';

export async function authenticate(serviceUrl: string) {
  const keypair = await loadAgentKeypair();
  const client = new SIWAClient({ keypair });
  return client.signIn(serviceUrl);
}
```

### Express Server

```typescript
import express from 'express';
import { SIWAServer } from '@siwa/server';

const app = express();
const siwa = new SIWAServer({
  domain: 'api.example.com',
  uri: 'https://api.example.com',
});

app.get('/siwa/challenge', async (req, res) => {
  const challenge = await siwa.createChallenge(req.query.pubkey);
  res.json(challenge);
});

app.post('/siwa/verify', express.json(), async (req, res) => {
  const session = await siwa.verifySignature(
    req.body.message,
    req.body.pubkey,
    req.body.signature
  );
  res.json(session);
});

// Protected routes
app.get('/api/data', siwa.middleware(), (req, res) => {
  res.json({ agent: req.agentAddress, data: 'secret' });
});
```

## Resources

- **Website**: https://getsiwa.com
- **GitHub**: https://github.com/borninshell/siwa
- **Demo**: https://getsiwa.com/demo.html
- **Built by**: [The Shellborn Collective](https://shellborn.io)

## License

Apache 2.0 — see [LICENSE](./LICENSE) for details.
