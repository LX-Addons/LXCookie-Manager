import { storage } from "wxt/utils/storage";

type StorageKey = `local:${string}` | `session:${string}` | `sync:${string}` | `managed:${string}`;

const DEFAULT_LOCK_TIMEOUT_MS = 60 * 1000;
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_RETRY_DELAY_MS = 50;

const memoryLocks = new Map<string, { lockId: string; expiresAt: number }>();

interface LockData {
  lockId: string;
  acquiredAt: number;
  expiresAt: number;
}

export class DistributedLock {
  private readonly lockKey: StorageKey;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly retryDelayMs: number;
  private currentLockId: string | null = null;
  private releasePromise: Promise<boolean> | null = null;

  constructor(
    name: string,
    timeoutMs: number = DEFAULT_LOCK_TIMEOUT_MS,
    maxRetries: number = DEFAULT_MAX_RETRIES,
    retryDelayMs: number = DEFAULT_RETRY_DELAY_MS
  ) {
    this.lockKey = `local:lock:${name}` as StorageKey;
    this.timeoutMs = timeoutMs;
    this.maxRetries = maxRetries;
    this.retryDelayMs = retryDelayMs;
  }

  private isLockExpired(lock: { expiresAt: number }): boolean {
    return lock.expiresAt <= Date.now();
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async acquire(): Promise<boolean> {
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      const result = await this.tryAcquire();
      if (result) {
        return true;
      }
      if (attempt < this.maxRetries) {
        await this.delay(this.retryDelayMs * (attempt + 1));
      }
    }
    return false;
  }

  private async tryAcquire(): Promise<boolean> {
    const now = Date.now();
    const memoryLock = memoryLocks.get(this.lockKey);

    if (memoryLock && !this.isLockExpired(memoryLock)) {
      const storageLock = await storage.getItem<LockData>(this.lockKey);
      if (
        storageLock?.lockId === memoryLock.lockId &&
        !this.isLockExpired({ expiresAt: storageLock.expiresAt })
      ) {
        return false;
      }
      memoryLocks.delete(this.lockKey);
    }

    const storageLock = await storage.getItem<LockData>(this.lockKey);
    if (storageLock && !this.isLockExpired({ expiresAt: storageLock.expiresAt })) {
      memoryLocks.set(this.lockKey, {
        lockId: storageLock.lockId,
        expiresAt: storageLock.expiresAt,
      });
      return false;
    }

    const lockId = `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;

    const lockData: LockData = {
      lockId: lockId,
      acquiredAt: now,
      expiresAt: now + this.timeoutMs,
    };

    try {
      await storage.setItem(this.lockKey, lockData);

      const verifyLock = await storage.getItem<LockData>(this.lockKey);
      if (!verifyLock || verifyLock.lockId !== lockId) {
        return false;
      }

      this.currentLockId = lockId;
      memoryLocks.set(this.lockKey, {
        lockId: lockId,
        expiresAt: lockData.expiresAt,
      });
      return true;
    } catch (error) {
      console.error(`[DistributedLock] Failed to acquire lock ${this.lockKey}:`, error);
      this.currentLockId = null;
      return false;
    }
  }

  async release(): Promise<boolean> {
    const memoryLock = memoryLocks.get(this.lockKey);

    if (this.currentLockId === null || memoryLock?.lockId !== this.currentLockId) {
      return false;
    }

    try {
      const storageLock = await storage.getItem<LockData>(this.lockKey);

      if (!storageLock) {
        memoryLocks.delete(this.lockKey);
        this.currentLockId = null;
        return true;
      }

      if (storageLock.lockId !== this.currentLockId) {
        memoryLocks.delete(this.lockKey);
        this.currentLockId = null;
        return false;
      }

      if (this.isLockExpired({ expiresAt: storageLock.expiresAt })) {
        memoryLocks.delete(this.lockKey);
        this.currentLockId = null;
        return false;
      }

      await storage.removeItem(this.lockKey);
      memoryLocks.delete(this.lockKey);
      this.currentLockId = null;
    } catch (error) {
      console.error(`[DistributedLock] Failed to release lock ${this.lockKey}:`, error);
      return false;
    }
    return true;
  }

  async withLock<T>(fn: () => Promise<T>): Promise<{ acquired: boolean; result?: T }> {
    const acquired = await this.acquire();

    if (!acquired) {
      return { acquired: false };
    }

    try {
      const result = await fn();
      return { acquired: true, result };
    } finally {
      this.releasePromise = this.release();
      await this.releasePromise;
    }
  }

  async isLocked(): Promise<boolean> {
    const memoryLock = memoryLocks.get(this.lockKey);

    if (memoryLock && !this.isLockExpired(memoryLock)) {
      return true;
    }

    const storageLock = await storage.getItem<LockData>(this.lockKey);
    if (!storageLock || this.isLockExpired({ expiresAt: storageLock.expiresAt })) {
      memoryLocks.delete(this.lockKey);
      return false;
    }

    memoryLocks.set(this.lockKey, {
      lockId: storageLock.lockId,
      expiresAt: storageLock.expiresAt,
    });
    return true;
  }
}

export function createCleanupLock(): DistributedLock {
  return new DistributedLock("scheduled-cleanup", 2 * 60 * 1000);
}
