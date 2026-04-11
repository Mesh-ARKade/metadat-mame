/**
 * VersionTracker - Handles versions.json read/write for source version tracking
 *
 * @intent Track version information for each source to enable skip logic
 * @guarantee Thread-safe file read/write, handles missing files gracefully
 */

import fs from 'fs';
import fsPromises from 'fs/promises';
import path from 'path';
import type { VersionInfo } from '../types/index.js';

export class VersionTracker {
  private filePath: string;

  constructor(filePath: string = './versions.json') {
    this.filePath = filePath;
  }

  /**
   * Read version info for a specific source (synchronous)
   * @param source Source name (e.g., "no-intro", "tosec")
   * @returns VersionInfo or null if not found
   */
  read(source: string): VersionInfo | null {
    try {
      const content = fs.readFileSync(this.filePath, 'utf-8');
      const data: Record<string, VersionInfo> = JSON.parse(content);
      return data[source] || null;
    } catch {
      return null;
    }
  }

  /**
   * Write version info for a source (asynchronous)
   * @param source Source name
   * @param version Version string
   */
  async write(source: string, version: string): Promise<void> {
    const data = this.readAll();

    data[source] = {
      version,
      lastChecked: new Date().toISOString()
    };

    // Ensure directory exists
    const dir = path.dirname(this.filePath);
    await fsPromises.mkdir(dir, { recursive: true }).catch(() => {});

    await fsPromises.writeFile(this.filePath, JSON.stringify(data, null, 2) + '\n');
  }

  /**
   * Get last checked timestamp for a source
   * @param source Source name
   * @returns Date or null if not found
   */
  getLastChecked(source: string): Date | null {
    const info = this.read(source);
    if (!info?.lastChecked) {
      return null;
    }
    return new Date(info.lastChecked);
  }

  /**
   * Save artifact SHA256 hashes for incremental releases
   * @param source Source name
   * @param artifacts Map of artifact name to SHA256 hash
   */
  async saveArtifactHashes(source: string, artifacts: Record<string, string>): Promise<void> {
    const data = this.readAll();
    
    if (!data[source]) {
      data[source] = { version: '', lastChecked: '' };
    }
    
    data[source].artifacts = artifacts;
    data[source].lastChecked = new Date().toISOString();

    const dir = path.dirname(this.filePath);
    await fsPromises.mkdir(dir, { recursive: true }).catch(() => {});
    await fsPromises.writeFile(this.filePath, JSON.stringify(data, null, 2) + '\n');
  }

  /**
   * Get artifact SHA256 hashes for a source
   * @param source Source name
   * @returns Map of artifact name to SHA256 hash, or empty object if not found
   */
  async getArtifactHashes(source: string): Promise<Record<string, string>> {
    const info = this.read(source);
    return info?.artifacts || {};
  }

  /**
   * Read all version data (synchronous)
   */
  private readAll(): Record<string, VersionInfo> {
    try {
      const content = fs.readFileSync(this.filePath, 'utf-8');
      return JSON.parse(content);
    } catch {
      return {};
    }
  }
}