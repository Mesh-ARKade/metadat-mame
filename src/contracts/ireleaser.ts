/**
 * IReleaser interface
 *
 * @intent Define the contract for creating GitHub releases
 * @guarantee Implementations create releases and upload artifacts
 */

import type { Artifact, Release } from '../types/index.js';

export interface IReleaser {
  /**
   * Create a GitHub release and upload artifacts
   * @param tag Release tag name
   * @param artifacts Array of artifacts to upload
   * @returns Release object with metadata
   */
  createRelease(tag: string, artifacts: Artifact[]): Promise<Release>;

  /**
   * Check if a release already exists
   * @param tag Release tag name
   * @returns true if release exists
   */
  releaseExists(tag: string): Promise<boolean>;

  /**
   * Delete a release
   * @param tag Release tag name
   */
  deleteRelease(tag: string): Promise<void>;
}