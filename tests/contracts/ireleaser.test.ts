/**
 * IReleaser contract tests
 *
 * @intent Verify IReleaser interface contract
 * @guarantee Implementations conform to the expected interface
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { IReleaser } from '../../src/contracts/ireleaser.js';
import type { Artifact, Release } from '../../src/types/index.js';

describe('IReleaser Contract', () => {
  let mockReleaser: IReleaser;

  const mockRelease: Release = {
    tag: 'v1.0.0',
    name: 'Release v1.0.0',
    body: 'Test release',
    draft: false,
    prerelease: false,
    assets: [],
    htmlUrl: 'https://github.com/test/test/releases/tag/v1.0.0',
    createdAt: '2026-04-09T00:00:00Z'
  };

  beforeEach(() => {
    mockReleaser = {
      createRelease: vi.fn().mockResolvedValue(mockRelease),
      releaseExists: vi.fn().mockResolvedValue(false),
      deleteRelease: vi.fn().mockResolvedValue(undefined)
    };
  });

  describe('createRelease()', () => {
    it('should accept tag and artifacts', async () => {
      const artifacts: Artifact[] = [
        {
          name: 'test.jsonl.zst',
          path: '/tmp/test.jsonl.zst',
          size: 1000,
          sha256: 'abc123',
          entryCount: 10
        }
      ];

      const result = await mockReleaser.createRelease('v1.0.0', artifacts);

      expect(result).toHaveProperty('tag');
      expect(result).toHaveProperty('name');
      expect(result).toHaveProperty('body');
      expect(result).toHaveProperty('draft');
      expect(result).toHaveProperty('prerelease');
      expect(result).toHaveProperty('assets');
      expect(result).toHaveProperty('htmlUrl');
      expect(result).toHaveProperty('createdAt');
    });

    it('should return a Release object', async () => {
      const result = await mockReleaser.createRelease('v1.0.0', []);

      expect(result.tag).toBeDefined();
      expect(typeof result.draft).toBe('boolean');
      expect(typeof result.prerelease).toBe('boolean');
      expect(Array.isArray(result.assets)).toBe(true);
    });

    it('should be async', () => {
      const result = mockReleaser.createRelease('v1.0.0', []);
      expect(result).toBeInstanceOf(Promise);
    });
  });

  describe('releaseExists()', () => {
    it('should accept a tag string', async () => {
      const result = await mockReleaser.releaseExists('v1.0.0');

      expect(typeof result).toBe('boolean');
    });

    it('should be async', () => {
      const result = mockReleaser.releaseExists('v1.0.0');
      expect(result).toBeInstanceOf(Promise);
    });
  });

  describe('deleteRelease()', () => {
    it('should accept a tag string', async () => {
      await mockReleaser.deleteRelease('v1.0.0');

      expect(mockReleaser.deleteRelease).toHaveBeenCalledWith('v1.0.0');
    });

    it('should be async', () => {
      const result = mockReleaser.deleteRelease('v1.0.0');
      expect(result).toBeInstanceOf(Promise);
    });
  });
});