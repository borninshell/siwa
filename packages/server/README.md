# @siwa/server

SIWA server utilities and middleware for authenticating AI agents.

## Installation

```bash
npm install @siwa/server
```

## Quick Start

### Basic Setup (In-Memory Storage)

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
  try {
    const challenge = await siwa.createChallenge(
      req.query.pubkey as string,
      req.ip // for rate limiting
    );
    res.json(challenge);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Verify endpoint
app.post('/siwa/verify', async (req, res) => {
  try {
    const { message, pubkey, signature } = req.body;
    const session = await siwa.verifySignature(message, pubkey, signature);
    res.json(session);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Protected route
app.get('/api/data', siwa.middleware(), (req, res) => {
  res.json({ 
    message: 'Hello agent!',
    address: req.agentAddress 
  });
});
```

### Production Setup (Redis Storage)

For production deployments, use Redis-backed storage for persistence and multi-instance support:

```typescript
import { createClient } from 'redis';
import { SIWAServer, createRedisStores } from '@siwa/server';

// Create Redis client
const redis = createClient({ url: 'redis://localhost:6379' });
await redis.connect();

// Create Redis-backed stores
const stores = createRedisStores(redis, {
  sessionKeyPrefix: 'myservice:siwa:session:',
  nonceKeyPrefix: 'myservice:siwa:nonce:',
  rateLimitKeyPrefix: 'myservice:siwa:ratelimit:',
});

// Create SIWA server with Redis stores
const siwa = new SIWAServer({
  domain: 'api.myservice.com',
  uri: 'https://api.myservice.com',
  statement: 'Sign in to MyService',
  ...stores,
});
```

### Custom Redis Client

The Redis stores are compatible with popular Redis clients:

```typescript
import Redis from 'ioredis';
import { RedisSessionStore } from '@siwa/server';

// Using ioredis
const redis = new Redis('redis://localhost:6379');

// Create individual stores
const sessionStore = new RedisSessionStore(redis, {
  keyPrefix: 'myapp:sessions:',
});

const siwa = new SIWAServer({
  domain: 'api.myservice.com',
  uri: 'https://api.myservice.com',
  sessionStore,
  // ... other options
});
```

## Configuration Options

### SIWAServer Options

```typescript
interface SIWAServerOptions {
  /** Domain name of the service */
  domain: string;
  
  /** Full URI of the service */
  uri: string;
  
  /** Challenge expiration in minutes (default: 5) */
  challengeExpirationMinutes?: number;
  
  /** Session expiration in minutes (default: 60) */
  sessionExpirationMinutes?: number;
  
  /** Custom nonce store (default: in-memory) */
  nonceStore?: NonceStore;
  
  /** Custom session store (default: in-memory) */
  sessionStore?: SessionStore;
  
  /** Statement to include in auth message */
  statement?: string;
  
  /** Resources/scopes to request */
  resources?: string[];
  
  /** Rate limiting configuration */
  rateLimit?: RateLimitOptions | false;
}
```

### Rate Limiting

```typescript
interface RateLimitOptions {
  /** Maximum requests per window (default: 10) */
  maxRequests?: number;
  
  /** Window duration in minutes (default: 15) */
  windowMinutes?: number;
  
  /** Custom rate limit store */
  store?: RateLimitStore;
}
```

## Middleware

### Authentication Middleware

```typescript
// Require authentication
app.get('/api/protected', siwa.middleware(), (req, res) => {
  res.json({ agent: req.agentAddress });
});

// Optional authentication
app.get('/api/optional', siwa.middleware({ required: false }), (req, res) => {
  if (req.agentAddress) {
    res.json({ message: `Hello ${req.agentAddress}!` });
  } else {
    res.json({ message: 'Hello anonymous user!' });
  }
});
```

### Rate Limiting Middleware

```typescript
// Apply rate limiting to specific routes
app.use('/siwa', siwa.rateLimitMiddleware());
```

## Storage Backends

### In-Memory (Development)

Default storage backend. Suitable for development and single-instance deployments.

- ✅ Zero configuration
- ✅ Fast performance
- ❌ Not persistent
- ❌ Single instance only

### Redis (Production)

Persistent storage backend for production deployments.

- ✅ Persistent across restarts
- ✅ Multi-instance support
- ✅ Automatic expiration
- ✅ Atomic operations
- ❌ Requires Redis server

#### Redis Client Compatibility

Works with any Redis client implementing this interface:

```typescript
interface RedisClient {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, mode?: string, duration?: number): Promise<string | null>;
  setex(key: string, seconds: number, value: string): Promise<string | null>;
  del(key: string): Promise<number>;
  exists(key: string): Promise<number>;
  incr(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<number>;
}
```

## Security Features

### Nonce Management
- One-time use nonces prevent replay attacks
- Automatic expiration (default: 5 minutes)
- Atomic consume operation prevents race conditions

### Rate Limiting
- Configurable sliding window rate limiting
- IP-based or custom identifier support
- Automatic cleanup of expired rate limit data

### Session Management
- Secure session tokens
- Configurable expiration (default: 60 minutes)
- Automatic cleanup of expired sessions

## Error Handling

The library throws descriptive errors for various failure modes:

```typescript
try {
  const session = await siwa.verifySignature(message, pubkey, signature);
} catch (error) {
  if (error.message.includes('Rate limit exceeded')) {
    // Handle rate limiting
    res.status(429).json({ error: error.message });
  } else if (error.message.includes('Invalid or expired nonce')) {
    // Handle nonce issues
    res.status(400).json({ error: 'Challenge expired or already used' });
  } else {
    // Handle other errors
    res.status(400).json({ error: 'Authentication failed' });
  }
}
```

## Best Practices

1. **Use HTTPS** - Always serve SIWA endpoints over HTTPS in production
2. **Rate Limiting** - Enable rate limiting to prevent abuse
3. **Redis for Production** - Use Redis-backed stores for production deployments
4. **Monitor Sessions** - Track session creation and usage for security
5. **Custom Key Prefixes** - Use descriptive key prefixes when using Redis
6. **Error Logging** - Log authentication failures for security monitoring

## License

Apache 2.0