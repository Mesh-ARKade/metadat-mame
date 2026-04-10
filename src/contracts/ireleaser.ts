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
  createRelease(_tag: string, _artifacts: Artifact[]): Promise<Release>;

  /**
   * Check if a release already exists
   * @param _tag Release tag name
   * @returns true if release exists
   */
  releaseExists(_tag: string): Promise<boolean>;

  /**
   * Delete a release
   * @param _tag Release tag name
   */
  deleteRelease(_tag: string): Promise<void>;
}