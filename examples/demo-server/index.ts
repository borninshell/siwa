/**
 * SIWA Demo Server
 * 
 * A simple Express server demonstrating SIWA authentication.
 * 
 * Run with: npx tsx examples/demo-server/index.ts
 */

import express from 'express';
import { SIWAServer } from '@siwa/server';

const app = express();
app.use(express.json());

// Initialize SIWA server
const siwa = new SIWAServer({
  domain: 'demo.siwa.dev',
  uri: 'http://localhost:3000',
  statement: 'Sign in to SIWA Demo',
  resources: ['demo:read', 'demo:write'],
  sessionExpirationMinutes: 60,
});

// Health check
app.get('/', (req, res) => {
  res.json({
    service: 'SIWA Demo Server',
    version: '0.1.0',
    endpoints: {
      challenge: 'GET /siwa/challenge?pubkey=...',
      verify: 'POST /siwa/verify',
      protected: 'GET /api/me (requires auth)',
    },
  });
});

// Step 1: Get challenge (with rate limiting)
app.get('/siwa/challenge', siwa.rateLimitMiddleware(), async (req, res) => {
  try {
    const pubkey = req.query.pubkey as string;
    
    if (!pubkey) {
      return res.status(400).json({ error: 'pubkey query parameter required' });
    }
    
    const challenge = await siwa.createChallenge(pubkey);
    res.json(challenge);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

// Step 2: Verify signature
app.post('/siwa/verify', async (req, res) => {
  try {
    const { message, pubkey, signature } = req.body;
    
    if (!message || !pubkey || !signature) {
      return res.status(400).json({ 
        error: 'message, pubkey, and signature are required' 
      });
    }
    
    const session = await siwa.verifySignature(message, pubkey, signature);
    res.json(session);
  } catch (error) {
    res.status(401).json({ error: (error as Error).message });
  }
});

// Protected endpoint
app.get('/api/me', siwa.middleware(), (req: any, res) => {
  res.json({
    message: 'Hello, authenticated agent!',
    address: req.agentAddress,
    scopes: req.siwaSession.scopes,
    expiresAt: req.siwaSession.expiresAt,
  });
});

// Public endpoint
app.get('/api/public', (req, res) => {
  res.json({ message: 'This endpoint is public' });
});

// Optional auth endpoint
app.get('/api/optional', siwa.middleware({ required: false }), (req: any, res) => {
  if (req.agentAddress) {
    res.json({ 
      message: 'Hello, authenticated agent!', 
      address: req.agentAddress 
    });
  } else {
    res.json({ message: 'Hello, anonymous visitor!' });
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`
🔐 SIWA Demo Server running on http://localhost:${PORT}

Endpoints:
  GET  /                    - Service info
  GET  /siwa/challenge      - Get auth challenge
  POST /siwa/verify         - Verify signature
  GET  /api/me              - Protected endpoint
  GET  /api/public          - Public endpoint
  GET  /api/optional        - Optional auth endpoint

Try it:
  1. Get a challenge:
     curl "http://localhost:${PORT}/siwa/challenge?pubkey=YOUR_PUBKEY"

  2. Sign the message with your agent's keypair

  3. Verify and get session:
     curl -X POST "http://localhost:${PORT}/siwa/verify" \\
       -H "Content-Type: application/json" \\
       -d '{"message":"...","pubkey":"...","signature":"..."}'

  4. Access protected endpoint:
     curl "http://localhost:${PORT}/api/me" \\
       -H "Authorization: Bearer YOUR_SESSION_TOKEN"
  `);
});
