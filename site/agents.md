# SIWA - Agent Integration Guide

> Sign In With Agent — wallet-based authentication for autonomous AI agents.

## Demo Server

This demo server is live at `https://siwa-landing-black.vercel.app`

### Endpoints

- `GET /api/siwa/challenge?address=YOUR_PUBKEY` — Get a challenge to sign
- `POST /api/siwa/verify` — Verify signature and get session token

## Quick Test (curl)

```bash
# 1. Get challenge
curl "https://siwa-landing-black.vercel.app/api/siwa/challenge?address=YOUR_WALLET_ADDRESS"

# 2. Sign the message with your wallet (use your agent's keypair)

# 3. Verify
curl -X POST "https://siwa-landing-black.vercel.app/api/siwa/verify" \
  -H "Content-Type: application/json" \
  -d '{"message": "...", "signature": "...", "publicKey": "..."}'
```

## Agent Integration

```typescript
import { Keypair } from '@solana/web3.js';
import nacl from 'tweetnacl';
import bs58 from 'bs58';

async function authenticateWithSIWA(keypair: Keypair) {
  const address = keypair.publicKey.toBase58();
  
  // 1. Get challenge
  const challengeRes = await fetch(
    `https://siwa-landing-black.vercel.app/api/siwa/challenge?address=${address}`
  );
  const { message, nonce } = await challengeRes.json();
  
  // 2. Sign the message
  const messageBytes = new TextEncoder().encode(message);
  const signatureBytes = nacl.sign.detached(messageBytes, keypair.secretKey);
  const signature = bs58.encode(signatureBytes);
  
  // 3. Verify and get session
  const verifyRes = await fetch(
    'https://siwa-landing-black.vercel.app/api/siwa/verify',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, signature, publicKey: address })
    }
  );
  
  const session = await verifyRes.json();
  return session; // { success: true, address, sessionToken }
}
```

## How It Works

SIWA uses Ed25519 signatures (same as Solana transactions). Your agent proves identity by signing a challenge message — no passwords, no API keys, no OAuth.

### Flow

1. **Request Challenge** — Agent sends wallet address
2. **Sign Message** — Agent signs the challenge with private key
3. **Verify** — Server verifies signature, returns session token
4. **Authenticated** — Use token for API calls

## Resources

- **Website**: https://siwa-landing-black.vercel.app
- **Interactive Demo**: https://siwa-landing-black.vercel.app/demo.html
- **GitHub**: https://github.com/borninshell/siwa
- **Built by**: [The Shellborn Collective](https://shellborn.io)
