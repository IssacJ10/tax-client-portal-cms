/**
 * Redis Client Service
 *
 * Provides a singleton Redis client for distributed caching and rate limiting.
 * Uses Cloud Memorystore for Redis when deployed to GCP.
 * Falls back to in-memory storage for local development if Redis is not available.
 */

import { createClient, RedisClientType } from 'redis';

// Singleton instance
let redisClient: RedisClientType | null = null;
let isConnected = false;
let connectionAttempted = false;

// In-memory fallback for local development
const memoryStore = new Map<string, { value: string; expiry?: number }>();

/**
 * Get or create Redis client
 * Falls back to in-memory storage if Redis is not configured
 */
export async function getRedisClient(): Promise<RedisClientType | null> {
  // If already connected, return the client
  if (redisClient && isConnected) {
    return redisClient;
  }

  // If we've already tried and failed, don't retry
  if (connectionAttempted && !isConnected) {
    return null;
  }

  const redisHost = process.env.REDIS_HOST;
  const redisPort = process.env.REDIS_PORT || '6379';

  // If Redis is not configured, return null (will use fallback)
  if (!redisHost || redisHost === 'UPDATE_WITH_REDIS_IP') {
    console.log('[Redis] Not configured, using in-memory fallback');
    connectionAttempted = true;
    return null;
  }

  try {
    connectionAttempted = true;

    redisClient = createClient({
      socket: {
        host: redisHost,
        port: parseInt(redisPort, 10),
        connectTimeout: 5000,
        reconnectStrategy: (retries) => {
          if (retries > 3) {
            console.error('[Redis] Max reconnection attempts reached');
            return false;
          }
          return Math.min(retries * 100, 3000);
        }
      }
    });

    redisClient.on('error', (err) => {
      console.error('[Redis] Client error:', err.message);
      isConnected = false;
    });

    redisClient.on('connect', () => {
      console.log('[Redis] Connected to Cloud Memorystore');
      isConnected = true;
    });

    redisClient.on('disconnect', () => {
      console.log('[Redis] Disconnected');
      isConnected = false;
    });

    await redisClient.connect();
    return redisClient;
  } catch (error: any) {
    console.error('[Redis] Connection failed:', error.message);
    console.log('[Redis] Falling back to in-memory storage');
    isConnected = false;
    return null;
  }
}

/**
 * Rate limit check with Redis or fallback
 * Uses sliding window algorithm for accurate rate limiting
 */
export async function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): Promise<{ allowed: boolean; remaining: number; retryAfter?: number }> {
  const client = await getRedisClient();
  const now = Date.now();
  const windowKey = `ratelimit:${key}`;

  if (client) {
    // Redis-based rate limiting using sorted set (sliding window)
    try {
      const windowStart = now - windowMs;

      // Use a transaction for atomic operations
      const multi = client.multi();

      // Remove old entries outside the window
      multi.zRemRangeByScore(windowKey, 0, windowStart);

      // Count current entries in window
      multi.zCard(windowKey);

      // Add current request
      multi.zAdd(windowKey, { score: now, value: `${now}:${Math.random()}` });

      // Set expiry on the key
      multi.expire(windowKey, Math.ceil(windowMs / 1000) + 1);

      const results = await multi.exec();
      // results[1] is the zCard result (count of entries in sorted set)
      const currentCount = typeof results?.[1] === 'number' ? results[1] : 0;

      if (currentCount >= maxRequests) {
        // Get the oldest entry to calculate retry time
        const oldest = await client.zRange(windowKey, 0, 0, { BY: 'SCORE' });
        let retryAfter = Math.ceil(windowMs / 1000);

        if (oldest.length > 0) {
          const oldestTime = parseInt(oldest[0].split(':')[0], 10);
          retryAfter = Math.ceil((oldestTime + windowMs - now) / 1000);
        }

        return {
          allowed: false,
          remaining: 0,
          retryAfter: Math.max(1, retryAfter)
        };
      }

      return {
        allowed: true,
        remaining: Math.max(0, maxRequests - currentCount - 1)
      };
    } catch (error: any) {
      console.error('[Redis] Rate limit check failed:', error.message);
      // Fall through to in-memory fallback
    }
  }

  // In-memory fallback (for local dev or Redis failure)
  return checkRateLimitMemory(key, maxRequests, windowMs);
}

/**
 * In-memory rate limiting fallback
 */
function checkRateLimitMemory(
  key: string,
  maxRequests: number,
  windowMs: number
): { allowed: boolean; remaining: number; retryAfter?: number } {
  const now = Date.now();
  const windowKey = `ratelimit:${key}`;

  // Clean up expired entries periodically
  if (Math.random() < 0.01) { // 1% chance
    cleanupMemoryStore();
  }

  const stored = memoryStore.get(windowKey);

  if (!stored || (stored.expiry && now > stored.expiry)) {
    // New window
    memoryStore.set(windowKey, {
      value: JSON.stringify({ count: 1, windowStart: now }),
      expiry: now + windowMs
    });
    return { allowed: true, remaining: maxRequests - 1 };
  }

  const data = JSON.parse(stored.value);

  if (now - data.windowStart > windowMs) {
    // Window expired, reset
    memoryStore.set(windowKey, {
      value: JSON.stringify({ count: 1, windowStart: now }),
      expiry: now + windowMs
    });
    return { allowed: true, remaining: maxRequests - 1 };
  }

  if (data.count >= maxRequests) {
    const retryAfter = Math.ceil((data.windowStart + windowMs - now) / 1000);
    return { allowed: false, remaining: 0, retryAfter: Math.max(1, retryAfter) };
  }

  data.count++;
  memoryStore.set(windowKey, {
    value: JSON.stringify(data),
    expiry: data.windowStart + windowMs
  });

  return { allowed: true, remaining: maxRequests - data.count };
}

/**
 * Cleanup expired entries from memory store
 */
function cleanupMemoryStore(): void {
  const now = Date.now();
  for (const [key, value] of memoryStore.entries()) {
    if (value.expiry && now > value.expiry) {
      memoryStore.delete(key);
    }
  }
}

/**
 * Generic cache get with Redis or fallback
 */
export async function cacheGet(key: string): Promise<string | null> {
  const client = await getRedisClient();

  if (client) {
    try {
      const result = await client.get(key);
      return typeof result === 'string' ? result : null;
    } catch (error) {
      console.error('[Redis] Get failed:', error);
    }
  }

  // Fallback to memory
  const stored = memoryStore.get(key);
  if (stored && (!stored.expiry || Date.now() <= stored.expiry)) {
    return stored.value;
  }
  return null;
}

/**
 * Generic cache set with Redis or fallback
 */
export async function cacheSet(key: string, value: string, ttlSeconds?: number): Promise<void> {
  const client = await getRedisClient();

  if (client) {
    try {
      if (ttlSeconds) {
        await client.setEx(key, ttlSeconds, value);
      } else {
        await client.set(key, value);
      }
      return;
    } catch (error) {
      console.error('[Redis] Set failed:', error);
    }
  }

  // Fallback to memory
  memoryStore.set(key, {
    value,
    expiry: ttlSeconds ? Date.now() + ttlSeconds * 1000 : undefined
  });
}

/**
 * Generic cache delete with Redis or fallback
 */
export async function cacheDelete(key: string): Promise<void> {
  const client = await getRedisClient();

  if (client) {
    try {
      await client.del(key);
      return;
    } catch (error) {
      console.error('[Redis] Delete failed:', error);
    }
  }

  memoryStore.delete(key);
}

/**
 * Check if Redis is available
 */
export function isRedisAvailable(): boolean {
  return isConnected;
}

export default {
  getRedisClient,
  checkRateLimit,
  cacheGet,
  cacheSet,
  cacheDelete,
  isRedisAvailable
};
