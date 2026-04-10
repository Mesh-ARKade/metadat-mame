/**
 * IFetcher interface
 *
 * @intent Define the contract for fetching DATs from a source
 * @guarantee Implementations fetch, provide source name, and handle version checking
 */

import type { DAT } from '../types/index.js';

export interface IFetcher {
  /**
   * Fetch DATs from the source
   * @returns Array of DAT objects
   */
  fetch(): Promise<DAT[]>;

  /**
   * Get the source name
   * @returns Source identifier (e.g., "no-intro", "tosec")
   */
  getSourceName(): string;

  /**
   * Check the remote version identifier
   * @returns Version string (format depends on source: "286", "2025-03-13", SHA, etc.)
   */
  checkRemoteVersion(): Promise<string>;

  /**
   * Get the stored version from versions.json
   * @returns Stored version or null if not found
   */
  getStoredVersion(): string | null;

  /**
   * Determine if the fetch should be skipped
   * @returns true if remote version matches stored version
   */
  shouldSkip(): Promise<boolean>;
}