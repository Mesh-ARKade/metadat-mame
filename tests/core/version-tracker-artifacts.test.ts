/**
 * VersionTracker artifact hash tests
 *
 * Tests for SHA256 tracking in versions.json
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { VersionTracker } from '../../src/core/version-tracker.js';
import fs from 'fs/promises';
import path from 'path';

describe('VersionTracker artifact hashes', () => {
  const testVersionsPath = './test-versions.json';
  
  beforeEach(async () => {
    // Clean up test file
    try {
      await fs.unlink(testVersionsPath);
    } catch {
      // File doesn't exist, ignore
    }
  });
  
  it('should save artifact hashes', async () => {
    const tracker = new VersionTracker(testVersionsPath);
    const artifacts = {
      'no-intro--nintendo.jsonl.zst': 'abc123sha256',
      'no-intro--sega.jsonl.zst': 'def456sha256'
    };
    
    await tracker.saveArtifactHashes('no-intro', artifacts);
    
    // Verify file was created with correct content
    const content = await fs.readFile(testVersionsPath, 'utf-8');
    const data = JSON.parse(content);
    
    expect(data['no-intro'].artifacts).toEqual(artifacts);
  });
  
  it('should get artifact hashes', async () => {
    const tracker = new VersionTracker(testVersionsPath);
    
    // First save some artifacts
    const artifacts = {
      'no-intro--nintendo.jsonl.zst': 'abc123sha256'
    };
    await tracker.saveArtifactHashes('no-intro', artifacts);
    
    // Then retrieve them
    const retrieved = await tracker.getArtifactHashes('no-intro');
    
    expect(retrieved).toEqual(artifacts);
  });
  
  it('should return empty object for unknown source', async () => {
    const tracker = new VersionTracker(testVersionsPath);
    
    const result = await tracker.getArtifactHashes('unknown-source');
    
    expect(result).toEqual({});
  });
  
  it('should overwrite existing artifacts for same source', async () => {
    const tracker = new VersionTracker(testVersionsPath);
    
    await tracker.saveArtifactHashes('no-intro', { 'a.json.zst': 'sha1' });
    await tracker.saveArtifactHashes('no-intro', { 'b.json.zst': 'sha2' });
    
    const result = await tracker.getArtifactHashes('no-intro');
    
    // Should only have the latest
    expect(Object.keys(result).length).toBe(1);
    expect(result['b.json.zst']).toBe('sha2');
  });
});