# SIWA - Sign In With Agent

![Tests](https://img.shields.io/badge/tests-32%20passing-brightgreen)
![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue)
![License](https://img.shields.io/badge/license-Apache%202.0-blue)

> Wallet-based authentication for autonomous AI agents

## What is SIWA?

SIWA is to AI agents what "Sign In With Google" is to humans — a standardized way for agents to authenticate with services. Instead of OAuth redirects or manually provisioned API keys, agents prove their identity by signing a challenge with their Solana keypair.

**No humans. No browsers. Just cryptography.**

## How It Works

```
Agent                           Service
  |                                |
  |  1. GET /siwa/challenge        |
  |------------------------------->|
  |                                |
  |  2. { challenge, nonce, ... }  |
  |<-------------------------------|
  |                                |
  |  3. POST /siwa/verify          |
  |     { message, signature }     |
  |------------------------------->|
  |                                |
  |  4. { session_token, expires } |
  |<-------------------------------|
  |                                |
  |  5. API calls with token       |
  |------------------------------->|
```

## Packages

| Package | Description |
|---------|-------------|
| `@siwa/core` | Message format, parsing, verification |
| `@siwa/client` | Client SDK for agents |
| `@siwa/server` | Server utilities and middleware |

## Quick Start

### For Services (Server)

```typescript
import express from 'express';
import { SIWAServer } from '@siwa/server';

const app = express();
const siwa = new SIWAServer({
  domain: 'api.myservice.com',
  uri: 'https://api.myservice.com',
  statement: 'Sign in to MyService',
});

// Challenge endpoint
app.get('/siwa/challenge', async (req, res) => {
  const challenge = await siwa.createChallenge(req.query.pubkey);
  res.json(challenge);
});

// Verify endpoint
app.post('/siwa/verify', async (req, res) => {
  const { message, pubkey, signature } = req.body;
  const session = await siwa.verifySignature(message, pubkey, signature);
  res.json(session);
});

// Protected route
app.get('/api/data', siwa.middleware(), (req, res) => {
  res.json({ agent: req.agentAddress });
});
```

### For Agents (Client)

```typescript
import { Keypair } from '@solana/web3.js';
import { SIWAClient } from '@siwa/client';

// Agent's keypair
const keypair = Keypair.generate();

// Create client
const siwa = new SIWAClient({ keypair });

// Sign in
const session = await siwa.signIn('https://api.myservice.com');

// Use authenticated fetch
const authedFetch = siwa.authenticatedFetch(session);
const data = await authedFetch('https://api.myservice.com/api/data');
```

## Message Format

SIWA uses a human-readable message format similar to SIWE:

```
api.myservice.com wants you to sign in with your Solana account:
8xKJf9QpR7...

Sign in to MyService

URI: https://api.myservice.com
Version: 1
Chain ID: mainnet-beta
Nonce: a1b2c3d4e5f6...
Issued At: 2026-02-01T12:00:00Z
Expiration Time: 2026-02-01T12:05:00Z
Resources:
- api:read
- api:write
```

## Security

- **Nonces**: One-time use, prevents replay attacks
- **Expiration**: Challenges expire in 5 minutes
- **Domain binding**: Message includes the requesting domain
- **Ed25519 signatures**: Same as Solana transactions

## Development

```bash
# Install dependencies
npm install

# Build all packages
npm run build

# Run demo server
npx tsx examples/demo-server/index.ts

# Run demo client (in another terminal)
npx tsx examples/demo-client/index.ts
```

## Roadmap

- [x] Core message format
- [x] Signature verification
- [x] Express middleware
- [x] Redis session store
- [x] Rate limiting
- [ ] DID integration
- [ ] Verifiable Credentials
- [ ] Multi-chain support

## License

Apache 2.0

---

Built for agents, by agents* 🤖

*with some human help
