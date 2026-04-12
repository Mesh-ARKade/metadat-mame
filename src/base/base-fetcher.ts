/**
 * AbstractFetcher - Base class for all source fetchers
 *
 * @intent Provide common patterns: retry logic, rate limiting, version checking
 * @guarantee Sources extend this class and implement abstract methods
 */

import type { DAT } from '../types/index.js';
import type { IFetcher } from '../contracts/ifetcher.js';
import { VersionTracker } from '../core/version-tracker.js';

export interface FetcherOptions {
  maxRetries?: number;
  retryDelay?: number;
  rateLimitMs?: number;
}

export abstract class AbstractFetcher implements IFetcher {
  protected versionTracker: VersionTracker;
  protected maxRetries: number;
  protected retryDelay: number;
  protected rateLimitMs: number;
  private lastRequestTime: number = 0;

  constructor(versionTracker: VersionTracker, options: FetcherOptions = {}) {
    this.versionTracker = versionTracker;
    this.maxRetries = options.maxRetries ?? 3;
    this.retryDelay = options.retryDelay ?? 1000;
    this.rateLimitMs = options.rateLimitMs ?? 0;
  }

  /**
   * Fetch DATs from the source - implemented by subclasses
   * @param onEntry Optional callback for streaming entries during fetch
   */
  abstract fetchDats(onEntry?: (dat: DAT) => void): Promise<DAT[]>;

  /**
   * Get source name - implemented by subclasses
   */
  abstract getSourceName(): string;

  /**
   * Check remote version - implemented by subclasses
   */
  abstract checkRemoteVersion(): Promise<string>;

  /**
   * Main fetch method with retry and rate limiting
   * @param onEntry Optional callback for streaming entries during fetch
   */
  async fetch(onEntry?: (dat: DAT) => void): Promise<DAT[]> {
    await this.applyRateLimit();
    return this.executeWithRetry(() => this.fetchDats(onEntry));
  }

  /**
   * Get stored version from versions.json
   */
  getStoredVersion(): string | null {
    const info = this.versionTracker.read(this.getSourceName());
    return info?.version ?? null;
  }

  /**
   * Check if fetch should be skipped (no changes)
   */
  async shouldSkip(): Promise<boolean> {
    const remote = await this.checkRemoteVersion();
    const stored = this.getStoredVersion();
    return remote === stored;
  }

  /**
   * Update stored version after successful fetch
   */
  protected async updateVersion(version: string): Promise<void> {
    await this.versionTracker.write(this.getSourceName(), version);
  }

  /**
   * Apply rate limiting between requests
   */
  private async applyRateLimit(): Promise<void> {
    if (this.rateLimitMs <= 0) return;

    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;

    if (timeSinceLastRequest < this.rateLimitMs) {
      const waitTime = this.rateLimitMs - timeSinceLastRequest;
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }

    this.lastRequestTime = Date.now();
  }

  /**
   * Execute function with retry logic
   */
  private async executeWithRetry<T>(fn: () => Promise<T>): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        return await fn();
      } catch (err) {
        lastError = err as Error;
        
        if (attempt < this.maxRetries) {
          // Exponential backoff
          const delay = this.retryDelay * Math.pow(2, attempt - 1);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError;
  }
}