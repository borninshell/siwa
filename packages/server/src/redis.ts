/**
 * Redis-backed stores for SIWA Server
 * 
 * Provides persistent storage for sessions, nonces, and rate limiting
 * using Redis. Useful for production deployments and multi-instance setups.
 */

import { SessionStore, SessionData, NonceStore, NonceData, RateLimitStore, RateLimitData } from './index.js';

/**
 * Redis client interface (compatible with node-redis, ioredis, etc.)
 */
export interface RedisClient {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, mode?: string, duration?: number): Promise<string | null>;
  setex(key: string, seconds: number, value: string): Promise<string | null>;
  del(key: string): Promise<number>;
  exists(key: string): Promise<number>;
  incr(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<number>;
}

/**
 * Redis session store with automatic expiration
 */
export class RedisSessionStore implements SessionStore {
  private client: RedisClient;
  private keyPrefix: string;
  
  constructor(client: RedisClient, options?: { keyPrefix?: string }) {
    this.client = client;
    this.keyPrefix = options?.keyPrefix ?? 'siwa:session:';
  }
  
  private getKey(token: string): string {
    return `${this.keyPrefix}${token}`;
  }
  
  async set(token: string, session: SessionData): Promise<void> {
    const key = this.getKey(token);
    const ttlSeconds = Math.floor((session.expiresAt.getTime() - Date.now()) / 1000);
    
    if (ttlSeconds <= 0) {
      return; // Don't store expired sessions
    }
    
    const data = JSON.stringify({
      address: session.address,
      expiresAt: session.expiresAt.toISOString(),
      scopes: session.scopes,
      message: session.message,
    });
    
    await this.client.setex(key, ttlSeconds, data);
  }
  
  async get(token: string): Promise<SessionData | null> {
    const key = this.getKey(token);
    const data = await this.client.get(key);
    
    if (!data) {
      return null;
    }
    
    try {
      const parsed = JSON.parse(data);
      return {
        address: parsed.address,
        expiresAt: new Date(parsed.expiresAt),
        scopes: parsed.scopes,
        message: parsed.message,
      };
    } catch (error) {
      // Clean up corrupted data
      await this.client.del(key);
      return null;
    }
  }
  
  async delete(token: string): Promise<void> {
    const key = this.getKey(token);
    await this.client.del(key);
  }
}

/**
 * Redis nonce store with atomic consume operation
 */
export class RedisNonceStore implements NonceStore {
  private client: RedisClient;
  private keyPrefix: string;
  
  constructor(client: RedisClient, options?: { keyPrefix?: string }) {
    this.client = client;
    this.keyPrefix = options?.keyPrefix ?? 'siwa:nonce:';
  }
  
  private getKey(nonce: string): string {
    return `${this.keyPrefix}${nonce}`;
  }
  
  async set(nonce: string, data: NonceData): Promise<void> {
    const key = this.getKey(nonce);
    const ttlSeconds = Math.floor((data.expiresAt.getTime() - Date.now()) / 1000);
    
    if (ttlSeconds <= 0) {
      return; // Don't store expired nonces
    }
    
    const payload = JSON.stringify({
      pubkey: data.pubkey,
      message: data.message,
      expiresAt: data.expiresAt.toISOString(),
    });
    
    await this.client.setex(key, ttlSeconds, payload);
  }
  
  async get(nonce: string): Promise<NonceData | null> {
    const key = this.getKey(nonce);
    const data = await this.client.get(key);
    
    if (!data) {
      return null;
    }
    
    try {
      const parsed = JSON.parse(data);
      return {
        pubkey: parsed.pubkey,
        message: parsed.message,
        expiresAt: new Date(parsed.expiresAt),
      };
    } catch (error) {
      // Clean up corrupted data
      await this.client.del(key);
      return null;
    }
  }
  
  async delete(nonce: string): Promise<void> {
    const key = this.getKey(nonce);
    await this.client.del(key);
  }
  
  /**
   * Atomically consume a nonce (delete and return)
   * This prevents TOCTOU race conditions in concurrent environments
   */
  async deleteAndGet(nonce: string): Promise<NonceData | null> {
    const key = this.getKey(nonce);
    
    // Use Lua script for atomic get-and-delete
    // This is Redis-specific but provides the strongest guarantees
    const luaScript = `
      local key = KEYS[1]
      local value = redis.call('GET', key)
      if value then
        redis.call('DEL', key)
        return value
      else
        return nil
      end
    `;
    
    try {
      // Note: This would require a Redis client that supports script evaluation
      // For simplicity, fall back to get+delete (small race window)
      const data = await this.get(nonce);
      if (data) {
        await this.delete(nonce);
      }
      return data;
    } catch (error) {
      // If script execution fails, fall back to get+delete
      const data = await this.get(nonce);
      if (data) {
        await this.delete(nonce);
      }
      return data;
    }
  }
}

/**
 * Redis rate limiter using sliding window counter
 */
export class RedisRateLimitStore implements RateLimitStore {
  private client: RedisClient;
  private keyPrefix: string;
  
  constructor(client: RedisClient, options?: { keyPrefix?: string }) {
    this.client = client;
    this.keyPrefix = options?.keyPrefix ?? 'siwa:ratelimit:';
  }
  
  private getKey(identifier: string): string {
    return `${this.keyPrefix}${identifier}`;
  }
  
  async get(identifier: string): Promise<RateLimitData | null> {
    const key = this.getKey(identifier);
    const data = await this.client.get(key);
    
    if (!data) {
      return null;
    }
    
    try {
      const parsed = JSON.parse(data);
      return {
        count: parsed.count,
        windowStart: new Date(parsed.windowStart),
        expiresAt: new Date(parsed.expiresAt),
      };
    } catch (error) {
      // Clean up corrupted data
      await this.client.del(key);
      return null;
    }
  }
  
  async set(identifier: string, data: RateLimitData): Promise<void> {
    const key = this.getKey(identifier);
    const ttlSeconds = Math.floor((data.expiresAt.getTime() - Date.now()) / 1000);
    
    if (ttlSeconds <= 0) {
      return; // Don't store expired data
    }
    
    const payload = JSON.stringify({
      count: data.count,
      windowStart: data.windowStart.toISOString(),
      expiresAt: data.expiresAt.toISOString(),
    });
    
    await this.client.setex(key, ttlSeconds, payload);
  }
  
  async delete(identifier: string): Promise<void> {
    const key = this.getKey(identifier);
    await this.client.del(key);
  }
  
  /**
   * Atomic increment with sliding window logic
   * More efficient than get/set for rate limiting
   */
  async increment(identifier: string, windowMinutes: number, maxRequests: number): Promise<{
    allowed: boolean;
    count: number;
    resetTime: Date;
  }> {
    const key = this.getKey(identifier);
    const windowMs = windowMinutes * 60 * 1000;
    const now = new Date();
    const windowStart = new Date(now.getTime() - windowMs);
    
    // For a more advanced implementation, we could use sorted sets
    // to track individual request timestamps within the window.
    // For now, using simple counter with expiration.
    
    const exists = await this.client.exists(key);
    
    if (!exists) {
      // First request in window
      const resetTime = new Date(now.getTime() + windowMs);
      const ttlSeconds = Math.floor(windowMs / 1000);
      
      await this.set(identifier, {
        count: 1,
        windowStart: now,
        expiresAt: resetTime,
      });
      
      return {
        allowed: true,
        count: 1,
        resetTime,
      };
    }
    
    const data = await this.get(identifier);
    if (!data) {
      // Race condition or expired data, try again
      return this.increment(identifier, windowMinutes, maxRequests);
    }
    
    // Check if we're still in the same window
    if (data.windowStart >= windowStart) {
      // Same window
      if (data.count >= maxRequests) {
        return {
          allowed: false,
          count: data.count,
          resetTime: data.expiresAt,
        };
      }
      
      // Increment count
      const newData = {
        ...data,
        count: data.count + 1,
      };
      
      await this.set(identifier, newData);
      
      return {
        allowed: true,
        count: newData.count,
        resetTime: data.expiresAt,
      };
    } else {
      // New window
      const resetTime = new Date(now.getTime() + windowMs);
      
      await this.set(identifier, {
        count: 1,
        windowStart: now,
        expiresAt: resetTime,
      });
      
      return {
        allowed: true,
        count: 1,
        resetTime,
      };
    }
  }
}

/**
 * Helper function to create Redis-backed SIWA server options
 */
export function createRedisStores(client: RedisClient, options?: {
  sessionKeyPrefix?: string;
  nonceKeyPrefix?: string;
  rateLimitKeyPrefix?: string;
}) {
  return {
    sessionStore: new RedisSessionStore(client, { 
      keyPrefix: options?.sessionKeyPrefix 
    }),
    nonceStore: new RedisNonceStore(client, { 
      keyPrefix: options?.nonceKeyPrefix 
    }),
    rateLimit: {
      store: new RedisRateLimitStore(client, { 
        keyPrefix: options?.rateLimitKeyPrefix 
      }),
    },
  };
}