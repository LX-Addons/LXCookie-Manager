import type { BackgroundMetric, MetricsSummary } from "@/types";
import { MetricType } from "@/types";

class RingBuffer<T> {
  private readonly buffer: Array<T | null>;
  private readonly capacity: number;
  private head: number;
  private tail: number;
  private size: number;

  constructor(capacity: number = 50) {
    this.capacity = capacity;
    this.buffer = new Array(capacity).fill(null);
    this.head = 0;
    this.tail = 0;
    this.size = 0;
  }

  push(item: T): void {
    if (this.size === this.capacity) {
      this.head = (this.head + 1) % this.capacity;
      this.size--;
    }
    this.buffer[this.tail] = item;
    this.tail = (this.tail + 1) % this.capacity;
    this.size++;
  }

  toArray(): T[] {
    const result: T[] = [];
    let current = this.head;
    for (let i = 0; i < this.size; i++) {
      const item = this.buffer[current];
      if (item !== null) {
        result.push(item);
      }
      current = (current + 1) % this.capacity;
    }
    return result;
  }

  clear(): void {
    this.buffer.fill(null);
    this.head = 0;
    this.tail = 0;
    this.size = 0;
  }

  getSize(): number {
    return this.size;
  }
}

class MetricsService {
  private readonly metrics: RingBuffer<BackgroundMetric>;

  constructor() {
    this.metrics = new RingBuffer<BackgroundMetric>(50);
  }

  recordMetric(
    type: MetricType,
    operation: string,
    success: boolean,
    durationMs: number,
    options?: {
      domain?: string;
      trigger?: string;
      errorCode?: string;
      metadata?: Record<string, unknown>;
    }
  ): void {
    const metric: BackgroundMetric = {
      id: crypto.randomUUID(),
      type,
      operation,
      success,
      durationMs,
      timestamp: Date.now(),
      domain: options?.domain,
      trigger: options?.trigger,
      errorCode: options?.errorCode,
      metadata: options?.metadata,
    };

    this.metrics.push(metric);
  }

  recordCleanup(
    operation: string,
    success: boolean,
    durationMs: number,
    options?: { domain?: string; trigger?: string; metadata?: Record<string, unknown> }
  ): void {
    this.recordMetric(MetricType.CLEANUP, operation, success, durationMs, options);
  }

  recordCookieMutation(
    operation: string,
    success: boolean,
    durationMs: number,
    options?: { domain?: string; errorCode?: string; metadata?: Record<string, unknown> }
  ): void {
    this.recordMetric(MetricType.COOKIE_MUTATION, operation, success, durationMs, options);
  }

  recordAudit(
    operation: string,
    success: boolean,
    durationMs: number,
    options?: { domain?: string; metadata?: Record<string, unknown> }
  ): void {
    this.recordMetric(MetricType.AUDIT, operation, success, durationMs, options);
  }

  recordError(
    operation: string,
    errorCode: string,
    durationMs: number = 0,
    options?: { domain?: string; trigger?: string; metadata?: Record<string, unknown> }
  ): void {
    this.recordMetric(MetricType.ERROR, operation, false, durationMs, {
      ...options,
      errorCode,
    });
  }

  recordMaintenance(
    operation: string,
    success: boolean,
    durationMs: number,
    options?: { metadata?: Record<string, unknown> }
  ): void {
    this.recordMetric(MetricType.MAINTENANCE, operation, success, durationMs, options);
  }

  getMetrics(): BackgroundMetric[] {
    return this.metrics.toArray();
  }

  getRecentMetrics(limit: number = 50): BackgroundMetric[] {
    const safeLimit = Math.max(0, limit);
    return this.metrics.toArray().slice(-safeLimit);
  }

  getSummary(): MetricsSummary {
    const allMetrics = this.metrics.toArray();
    const totalTasks = allMetrics.length;
    const successCount = allMetrics.filter((m) => m.success).length;
    const failureCount = totalTasks - successCount;
    const successRate = totalTasks > 0 ? successCount / totalTasks : 0;
    const failureRate = totalTasks > 0 ? failureCount / totalTasks : 0;
    const totalDuration = allMetrics.reduce((sum, m) => sum + m.durationMs, 0);
    const averageDurationMs = totalTasks > 0 ? totalDuration / totalTasks : 0;
    const recentFailures = allMetrics.filter((m) => !m.success).slice(-10);

    const byType: Record<
      MetricType,
      { count: number; successRate: number; averageDurationMs: number }
    > = {
      [MetricType.CLEANUP]: { count: 0, successRate: 0, averageDurationMs: 0 },
      [MetricType.COOKIE_MUTATION]: { count: 0, successRate: 0, averageDurationMs: 0 },
      [MetricType.AUDIT]: { count: 0, successRate: 0, averageDurationMs: 0 },
      [MetricType.ERROR]: { count: 0, successRate: 0, averageDurationMs: 0 },
      [MetricType.MAINTENANCE]: { count: 0, successRate: 0, averageDurationMs: 0 },
    };

    const typeStats: Record<
      MetricType,
      { count: number; successCount: number; totalDurationMs: number }
    > = {
      [MetricType.CLEANUP]: { count: 0, successCount: 0, totalDurationMs: 0 },
      [MetricType.COOKIE_MUTATION]: { count: 0, successCount: 0, totalDurationMs: 0 },
      [MetricType.AUDIT]: { count: 0, successCount: 0, totalDurationMs: 0 },
      [MetricType.ERROR]: { count: 0, successCount: 0, totalDurationMs: 0 },
      [MetricType.MAINTENANCE]: { count: 0, successCount: 0, totalDurationMs: 0 },
    };

    for (const metric of allMetrics) {
      const stat = typeStats[metric.type];
      stat.count++;
      if (metric.success) {
        stat.successCount++;
      }
      stat.totalDurationMs += metric.durationMs;
    }

    for (const type of Object.values(MetricType)) {
      const typeStat = typeStats[type];
      byType[type] = {
        count: typeStat.count,
        successRate: typeStat.count > 0 ? typeStat.successCount / typeStat.count : 0,
        averageDurationMs: typeStat.count > 0 ? typeStat.totalDurationMs / typeStat.count : 0,
      };
    }

    return {
      totalTasks,
      successRate,
      failureRate,
      averageDurationMs,
      successCount,
      failureCount,
      recentFailures,
      byType,
    };
  }

  clearMetrics(): void {
    this.metrics.clear();
  }
}

export const metricsService = new MetricsService();
