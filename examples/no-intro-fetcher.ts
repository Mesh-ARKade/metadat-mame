/**
 * Example: No-Intro Fetcher Implementation
 *
 * This is a reference implementation showing how to extend AbstractFetcher
 * for a specific source. Copy this pattern for metadat-nointro, metadat-tosec, etc.
 */

import type { DAT } from '../src/types/index.js';
import { AbstractFetcher, type FetcherOptions } from '../src/base/base-fetcher.js';
import { VersionTracker } from '../src/core/version-tracker.js';

/**
 * NoIntroFetcher - Fetches DATs from No-Intro (Dat-o-Matic)
 */
export class NoIntroFetcher extends AbstractFetcher {
  constructor(
    versionTracker: VersionTracker,
    options: FetcherOptions = {}
  ) {
    super(versionTracker, {
      maxRetries: options.maxRetries ?? 3,
      retryDelay: options.retryDelay ?? 2000,
      rateLimitMs: options.rateLimitMs ?? 1000
    });
  }

  /**
   * Get source name
   */
  getSourceName(): string {
    return 'nointro';
  }

  /**
   * Check remote version from Dat-o-Matic
   * @returns Version string (date-based)
   */
  async checkRemoteVersion(): Promise<string> {
    // TODO: Implement actual version check
    // - Visit https://datomatic.no-intro.org/
    // - Check the download page for latest date
    // - Return date string like "2026-04-09"
    return new Date().toISOString().split('T')[0];
  }

  /**
   * Fetch DATs from No-Intro
   * @returns Array of DAT objects
   */
  async fetchDats(): Promise<DAT[]> {
    // TODO: Implement actual fetching
    // 1. Use Playwright to navigate to Dat-o-Matic
    // 2. Check/uncheck appropriate checkboxes:
    //    - set1 = Main (keep checked)
    //    - set2 = Source Code (uncheck)
    //    - set3 = Non-Redump (keep checked)
    //    - set4 = Unofficial (keep checked)
    //    - set6 = Redump Custom (check)
    //    - set7 = Redump BIOS (check)
    //    - set8 = Aftermarket (check)
    // 3. Submit form and download zip
    // 4. Extract and parse DATs
    // 5. Return parsed DAT array
    
    console.log('[NoIntroFetcher] Fetching DATs...');
    return [];
  }
}

/**
 * Example usage:
 * 
 * const tracker = new VersionTracker('./versions.json');
 * const fetcher = new NoIntroFetcher(tracker);
 * 
 * // Check if we should skip
 * if (await fetcher.shouldSkip()) {
 *   console.log('No updates available');
 *   return;
 * }
 * 
 * // Fetch DATs
 * const dats = await fetcher.fetch();
 * 
 * // Update version after successful fetch
 * await fetcher.updateVersion(newVersion);
 */