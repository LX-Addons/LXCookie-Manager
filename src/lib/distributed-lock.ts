import { storage } from "wxt/utils/storage";

type StorageKey = `local:${string}` | `session:${string}` | `sync:${string}` | `managed:${string}`;

const DEFAULT_LOCK_TIMEOUT_MS = 120 * 1000;
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

  async withLockOrDefer<T>(
    fn: () => Promise<T>,
    maxWaitTimeMs: number = 5000,
    pollIntervalMs: number = 200
  ): Promise<{ acquired: boolean; result?: T }> {
    const deadline = Date.now() + maxWaitTimeMs;

    while (Date.now() < deadline) {
      const acquired = await this.tryAcquire();
      if (acquired) {
        try {
          const result = await fn();
          return { acquired: true, result };
        } finally {
          this.releasePromise = this.release();
          await this.releasePromise;
        }
      }

      const remaining = deadline - Date.now();
      if (remaining <= 0) break;
      await this.delay(Math.min(pollIntervalMs, remaining));
    }

    return { acquired: false };
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

export type CleanupTriggerType =
  | "tab-close"
  | "tab-discard"
  | "navigate"
  | "startup"
  | "scheduled"
  | "manual";

export type TaskLifecycleStatus =
  | "enqueued"
  | "waiting"
  | "executing"
  | "completed"
  | "failed"
  | "expired"
  | "discarded"
  | "rejected";

export type CleanupQueueErrorCode =
  | "QUEUE_FULL"
  | "GLOBAL_HARD_CAP_REACHED"
  | "TASK_EXPIRED"
  | "LOCK_RETRY_FAILED"
  | "TASK_EVICTED"
  | "QUEUE_CLEARED";

export class CleanupQueueError extends Error {
  constructor(
    public readonly code: CleanupQueueErrorCode,
    message: string,
    public readonly metadata?: {
      evictedTaskType?: CleanupTriggerType;
      incomingType?: CleanupTriggerType;
      queueLength?: number;
      maxSize?: number;
    }
  ) {
    super(message);
    this.name = "CleanupQueueError";
  }
}

const PRIORITY_WEIGHTS: Record<CleanupTriggerType, number> = {
  manual: 100,
  "tab-close": 90,
  navigate: 70,
  "tab-discard": 60,
  startup: 30,
  scheduled: 20,
};

const MAX_RETRIES_BY_PRIORITY: Record<CleanupTriggerType, number> = {
  manual: 5,
  "tab-close": 3,
  navigate: 2,
  "tab-discard": 2,
  startup: 1,
  scheduled: 1,
};

interface CleanupTask<T = void> {
  id: string;
  fn: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: Error) => void;
  createdAt: number;
  triggerType: CleanupTriggerType;
  retryCount: number;
}

interface TaskLogEntry {
  taskId: string;
  triggerType: CleanupTriggerType;
  status: TaskLifecycleStatus;
  timestamp: number;
  details?: string;
}

export class CleanupTaskQueue {
  private queue: CleanupTask<unknown>[] = [];
  private isProcessing = false;
  private readonly lock: DistributedLock;
  private readonly maxQueueSize: number;
  private readonly maxTabCloseSize: number;
  private readonly globalHardCap: number;
  private readonly maxTaskAgeMs: number;
  private currentTask: CleanupTask<unknown> | null = null;
  private readonly taskLog: TaskLogEntry[] = [];
  private readonly maxLogEntries = 100;
  private clearVersion = 0;

  constructor(maxQueueSize = 50, maxTaskAgeMs = 5 * 60 * 1000) {
    this.lock = createCleanupLock();
    this.maxQueueSize = maxQueueSize;
    this.globalHardCap = maxQueueSize * 2;
    this.maxTabCloseSize = Math.floor(this.globalHardCap * 0.8);
    this.maxTaskAgeMs = maxTaskAgeMs;
  }

  private logTaskStatus(
    taskId: string,
    triggerType: CleanupTriggerType,
    status: TaskLifecycleStatus,
    details?: string
  ): void {
    if (import.meta.env?.DEV !== true && import.meta.env?.MODE !== "development") {
      return;
    }

    const entry: TaskLogEntry = {
      taskId,
      triggerType,
      status,
      timestamp: Date.now(),
      details,
    };

    this.taskLog.push(entry);

    if (this.taskLog.length > this.maxLogEntries) {
      this.taskLog.shift();
    }

    const statusIcon = this.getStatusIcon(status);
    const timeStr = new Date(entry.timestamp).toISOString().slice(11, 23);
    const detailsSuffix = details ? ` - ${details}` : "";

    switch (status) {
      case "enqueued":
        console.debug(
          `[CleanupQueue] ${statusIcon} [${timeStr}] ${taskId} (${triggerType}) ENQUEUED${detailsSuffix}`
        );
        break;
      case "executing":
        console.debug(
          `[CleanupQueue] ${statusIcon} [${timeStr}] ${taskId} (${triggerType}) EXECUTING`
        );
        break;
      case "completed":
        console.debug(
          `[CleanupQueue] ${statusIcon} [${timeStr}] ${taskId} (${triggerType}) COMPLETED`
        );
        break;
      case "failed":
        console.error(
          `[CleanupQueue] ${statusIcon} [${timeStr}] ${taskId} (${triggerType}) FAILED${detailsSuffix}`
        );
        break;
      case "expired":
        console.warn(
          `[CleanupQueue] ${statusIcon} [${timeStr}] ${taskId} (${triggerType}) EXPIRED (age: ${details || "unknown"})`
        );
        break;
      case "discarded":
        console.warn(
          `[CleanupQueue] ${statusIcon} [${timeStr}] ${taskId} (${triggerType}) DISCARDED${detailsSuffix}`
        );
        break;
      case "rejected":
        console.error(
          `[CleanupQueue] ${statusIcon} [${timeStr}] ${triggerType} REJECTED${detailsSuffix}`
        );
        break;
      default:
        console.debug(
          `[CleanupQueue] ${statusIcon} [${timeStr}] ${taskId} (${triggerType}) ${status.toUpperCase()}`
        );
    }
  }

  private getStatusIcon(status: TaskLifecycleStatus): string {
    const icons: Record<TaskLifecycleStatus, string> = {
      enqueued: "➕",
      waiting: "⏳",
      executing: "▶️",
      completed: "✅",
      failed: "❌",
      expired: "⏰",
      discarded: "🗑️",
      rejected: "🚫",
    };
    return icons[status] || "📋";
  }

  private evictTask(
    evictIndex: number,
    triggerType: CleanupTriggerType,
    errorCode: CleanupQueueErrorCode,
    errorMessage: string,
    logDetails: string,
    maxSize: number,
    waitingCount: number
  ): void {
    const removed = this.queue.splice(evictIndex, 1)[0];
    removed.reject(
      new CleanupQueueError(errorCode, errorMessage, {
        evictedTaskType: removed.triggerType,
        incomingType: triggerType,
        queueLength: waitingCount,
        maxSize,
      })
    );
    this.logTaskStatus(removed.id, removed.triggerType, "discarded", logDetails);
  }

  private rejectAndLog(
    reject: (reason?: Error) => void,
    triggerType: CleanupTriggerType,
    errorCode: CleanupQueueErrorCode,
    errorMessage: string,
    logDetails: string,
    maxSize: number,
    waitingCount: number
  ): void {
    reject(
      new CleanupQueueError(errorCode, errorMessage, {
        incomingType: triggerType,
        queueLength: waitingCount,
        maxSize,
      })
    );
    this.logTaskStatus("unknown", triggerType, "rejected", logDetails);
  }

  private handleQueueFullForTabClose(
    waitingCount: number,
    triggerType: CleanupTriggerType,
    reject: (reason?: Error) => void
  ): boolean {
    const totalCount = this.getQueueLength();
    if (totalCount >= this.globalHardCap) {
      const evictIndex = this.findEvictableTaskIndex(triggerType);
      if (evictIndex === -1) {
        this.rejectAndLog(
          reject,
          triggerType,
          "GLOBAL_HARD_CAP_REACHED",
          `Global queue hard cap (${this.globalHardCap}) reached, no evictable task for ${triggerType}`,
          `global hard cap (${this.globalHardCap}) reached`,
          this.globalHardCap,
          waitingCount
        );
        return false;
      } else {
        const removed = this.queue[evictIndex];
        this.evictTask(
          evictIndex,
          triggerType,
          "TASK_EVICTED",
          `Global hard cap reached, ${removed.triggerType} task evicted by ${triggerType} (higher priority)`,
          `evicted by ${triggerType} (global hard cap, priority ${PRIORITY_WEIGHTS[triggerType]} > ${PRIORITY_WEIGHTS[removed.triggerType]})`,
          this.globalHardCap,
          waitingCount
        );
      }
    } else {
      const tabCloseCount = this.queue.filter((t) => t.triggerType === "tab-close").length;
      if (tabCloseCount >= this.maxTabCloseSize) {
        const oldestTabCloseIndex = this.findOldestTabCloseIndex();
        if (oldestTabCloseIndex !== -1) {
          this.evictTask(
            oldestTabCloseIndex,
            triggerType,
            "TASK_EVICTED",
            `Tab-close quota reached, oldest task removed`,
            `tab-close limit (${this.maxTabCloseSize}) reached, removed oldest`,
            this.maxTabCloseSize,
            waitingCount
          );
        }
      }
    }
    return true;
  }

  private handleQueueFullForOther(
    waitingCount: number,
    triggerType: CleanupTriggerType,
    reject: (reason?: Error) => void
  ): boolean {
    const evictIndex = this.findEvictableTaskIndex(triggerType);
    if (evictIndex !== -1) {
      const removed = this.queue[evictIndex];
      this.evictTask(
        evictIndex,
        triggerType,
        "TASK_EVICTED",
        `Queue full, ${removed.triggerType} task evicted by ${triggerType} (higher priority)`,
        `evicted by ${triggerType} (priority ${PRIORITY_WEIGHTS[triggerType]} > ${PRIORITY_WEIGHTS[removed.triggerType]})`,
        this.maxQueueSize,
        waitingCount
      );
    } else {
      this.rejectAndLog(
        reject,
        triggerType,
        "QUEUE_FULL",
        `Queue full (${waitingCount}/${this.maxQueueSize}), no evictable task for ${triggerType} (priority ${PRIORITY_WEIGHTS[triggerType]})`,
        `queue full (${waitingCount}/${this.maxQueueSize}), cannot evict`,
        this.maxQueueSize,
        waitingCount
      );
      return false;
    }
    return true;
  }

  async enqueue<T>(fn: () => Promise<T>, triggerType: CleanupTriggerType = "manual"): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const waitingCount = this.queue.length;
      const totalCount = this.getQueueLength();

      if (totalCount >= this.globalHardCap || waitingCount >= this.maxQueueSize) {
        if (triggerType === "tab-close") {
          if (!this.handleQueueFullForTabClose(waitingCount, triggerType, reject)) return;
        } else if (!this.handleQueueFullForOther(waitingCount, triggerType, reject)) {
          return;
        }
      }

      const task: CleanupTask<T> = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
        fn: async (): Promise<T> => {
          return await fn();
        },
        resolve,
        reject,
        createdAt: Date.now(),
        triggerType,
        retryCount: 0,
      };

      this.queue.push(task as CleanupTask<unknown>);
      this.logTaskStatus(
        task.id,
        triggerType,
        "enqueued",
        `waiting: ${this.queue.length}/${this.maxQueueSize}, executing: ${this.currentTask ? "yes" : "no"}, total: ${this.getQueueLength()}/${this.globalHardCap}`
      );

      this.processQueue().catch((error) => {
        console.error("[CleanupQueue] Error processing queue:", error);
      });
    });
  }

  private findOldestTabCloseIndex(): number {
    let oldestIndex = -1;
    let oldestTime = Infinity;

    for (let i = 0; i < this.queue.length; i++) {
      if (this.queue[i].triggerType === "tab-close" && this.queue[i].createdAt < oldestTime) {
        oldestTime = this.queue[i].createdAt;
        oldestIndex = i;
      }
    }

    return oldestIndex;
  }

  private findEvictableTaskIndex(incomingType: CleanupTriggerType): number {
    const incomingWeight = PRIORITY_WEIGHTS[incomingType];
    const candidates: Array<{ index: number; weight: number; createdAt: number }> = [];

    for (let i = 0; i < this.queue.length; i++) {
      const taskWeight = PRIORITY_WEIGHTS[this.queue[i].triggerType];
      if (taskWeight < incomingWeight) {
        candidates.push({ index: i, weight: taskWeight, createdAt: this.queue[i].createdAt });
      }
    }

    if (candidates.length === 0) return -1;

    candidates.sort((a, b) => {
      if (a.weight !== b.weight) return a.weight - b.weight;
      return a.createdAt - b.createdAt;
    });

    return candidates[0].index;
  }

  private selectNextTask(): CleanupTask<unknown> | null {
    if (this.queue.length === 0) return null;

    let highestPriorityIndex = 0;
    let highestPriority = PRIORITY_WEIGHTS[this.queue[0].triggerType];
    let oldestTime = this.queue[0].createdAt;

    for (let i = 1; i < this.queue.length; i++) {
      const taskPriority = PRIORITY_WEIGHTS[this.queue[i].triggerType];
      const taskTime = this.queue[i].createdAt;

      if (
        taskPriority > highestPriority ||
        (taskPriority === highestPriority && taskTime < oldestTime)
      ) {
        highestPriority = taskPriority;
        highestPriorityIndex = i;
        oldestTime = taskTime;
      }
    }

    return this.queue.splice(highestPriorityIndex, 1)[0];
  }

  private async handleLockNotAcquired(task: CleanupTask<unknown>): Promise<void> {
    const clearVersion = this.clearVersion;
    const maxRetries = MAX_RETRIES_BY_PRIORITY[task.triggerType];

    if (task.retryCount >= maxRetries) {
      this.logTaskStatus(
        task.id,
        task.triggerType,
        "rejected",
        `max retries (${maxRetries}) reached`
      );
      task.reject(
        new CleanupQueueError("LOCK_RETRY_FAILED", `Lock not acquired after ${maxRetries} retries`)
      );
      this.currentTask = null;
      return;
    }

    task.retryCount++;

    this.logTaskStatus(
      task.id,
      task.triggerType,
      "waiting",
      `lock not acquired, retry ${task.retryCount}/${maxRetries}`
    );
    await this.delay(500);

    if (clearVersion !== this.clearVersion) {
      task.reject(new CleanupQueueError("QUEUE_CLEARED", "Queue cleared"));
      this.currentTask = null;
      return;
    }

    this.queue.push(task);
    this.currentTask = null;
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.queue.length === 0) {
      return;
    }

    this.isProcessing = true;

    while (this.queue.length > 0) {
      const task = this.selectNextTask();
      if (!task) break;
      this.currentTask = task;

      this.logTaskStatus(task.id, task.triggerType, "executing");

      if (Date.now() - task.createdAt > this.maxTaskAgeMs) {
        this.currentTask = null;
        const ageMs = Date.now() - task.createdAt;
        task.reject(new CleanupQueueError("TASK_EXPIRED", "Task expired"));
        this.logTaskStatus(task.id, task.triggerType, "expired", `${(ageMs / 1000).toFixed(1)}s`);
        continue;
      }

      try {
        const result = await this.lock.withLock(async () => {
          return await task.fn();
        });

        if (!result.acquired) {
          await this.handleLockNotAcquired(task);
          continue;
        }

        this.currentTask = null;
        task.resolve(result.result);
        this.logTaskStatus(task.id, task.triggerType, "completed");
      } catch (error) {
        this.currentTask = null;
        task.reject(error as Error);
        this.logTaskStatus(
          task.id,
          task.triggerType,
          "failed",
          error instanceof Error ? error.message : String(error)
        );
      }
    }

    this.isProcessing = false;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  getQueueLength(): number {
    return this.queue.length + (this.currentTask ? 1 : 0);
  }

  getWaitingCount(): number {
    return this.queue.length;
  }

  getExecutingCount(): number {
    return this.currentTask ? 1 : 0;
  }

  getQueueStatus(): {
    waiting: number;
    executing: number;
    total: number;
    currentTaskType: CleanupTriggerType | null;
    triggerBreakdown: Record<CleanupTriggerType, number>;
    recentLogs: TaskLogEntry[];
  } {
    const breakdown: Record<string, number> = {
      "tab-close": 0,
      "tab-discard": 0,
      navigate: 0,
      startup: 0,
      scheduled: 0,
      manual: 0,
    };

    for (const task of this.queue) {
      breakdown[task.triggerType]++;
    }

    return {
      waiting: this.queue.length,
      executing: this.currentTask ? 1 : 0,
      total: this.queue.length + (this.currentTask ? 1 : 0),
      currentTaskType: this.currentTask?.triggerType || null,
      triggerBreakdown: breakdown as Record<CleanupTriggerType, number>,
      recentLogs: [...this.taskLog].slice(-20),
    };
  }

  clearQueue(): void {
    this.clearVersion++;
    for (const task of this.queue) {
      task.reject(new CleanupQueueError("QUEUE_CLEARED", "Queue cleared"));
      this.logTaskStatus(task.id, task.triggerType, "discarded", "queue cleared");
    }
    this.queue = [];
    console.log("[CleanupQueue] Queue cleared");
  }
}

let globalCleanupQueue: CleanupTaskQueue | null = null;

export function getGlobalCleanupQueue(): CleanupTaskQueue {
  globalCleanupQueue ??= new CleanupTaskQueue();
  return globalCleanupQueue;
}
