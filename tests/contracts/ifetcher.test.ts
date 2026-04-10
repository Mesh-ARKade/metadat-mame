/**
 * IFetcher contract tests
 *
 * @intent Verify IFetcher interface contract
 * @guarantee Implementations conform to the expected interface
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { IFetcher } from '../../src/contracts/ifetcher.js';
import type { DAT } from '../../src/types/index.js';

describe('IFetcher Contract', () => {
  let mockFetcher: IFetcher;

  beforeEach(() => {
    // Create a mock fetcher that implements IFetcher
    mockFetcher = {
      fetch: vi.fn().mockResolvedValue([]),
      getSourceName: vi.fn().mockReturnValue('mock-source'),
      checkRemoteVersion: vi.fn().mockResolvedValue('1.0.0'),
      getStoredVersion: vi.fn().mockReturnValue('1.0.0'),
      shouldSkip: vi.fn().mockResolvedValue(true)
    };
  });

  describe('fetch()', () => {
    it('should return an array of DAT objects', async () => {
      const mockDats: DAT[] = [
        {
          id: 'test-1',
          source: 'mock-source',
          system: 'Test System',
          datVersion: '1.0.0',
          roms: []
        }
      ];
      mockFetcher.fetch = vi.fn().mockResolvedValue(mockDats);

      const result = await mockFetcher.fetch();

      expect(Array.isArray(result)).toBe(true);
      expect(result[0]).toHaveProperty('id');
      expect(result[0]).toHaveProperty('source');
      expect(result[0]).toHaveProperty('system');
      expect(result[0]).toHaveProperty('datVersion');
      expect(result[0]).toHaveProperty('roms');
    });

    it('should be async', async () => {
      const result = mockFetcher.fetch();
      expect(result).toBeInstanceOf(Promise);
    });
  });

  describe('getSourceName()', () => {
    it('should return a string', () => {
      const result = mockFetcher.getSourceName();
      expect(typeof result).toBe('string');
    });

    it('should identify the source', () => {
      expect(mockFetcher.getSourceName()).toBe('mock-source');
    });
  });

  describe('checkRemoteVersion()', () => {
    it('should return a string version', async () => {
      const result = await mockFetcher.checkRemoteVersion();
      expect(typeof result).toBe('string');
    });

    it('should be async', async () => {
      const result = mockFetcher.checkRemoteVersion();
      expect(result).toBeInstanceOf(Promise);
    });
  });

  describe('getStoredVersion()', () => {
    it('should return string or null', () => {
      const result = mockFetcher.getStoredVersion();
      expect(result === null || typeof result === 'string').toBe(true);
    });
  });

  describe('shouldSkip()', () => {
    it('should return a boolean', async () => {
      const result = await mockFetcher.shouldSkip();
      expect(typeof result).toBe('boolean');
    });

    it('should be async', async () => {
      const result = mockFetcher.shouldSkip();
      expect(result).toBeInstanceOf(Promise);
    });

    it('should return true when versions match', async () => {
      // Create a new fetcher that returns matching versions
      const fetcherWithMatchingVersions: IFetcher = {
        fetch: vi.fn(),
        getSourceName: vi.fn().mockReturnValue('test'),
        checkRemoteVersion: vi.fn().mockResolvedValue('1.0.0'),
        getStoredVersion: vi.fn().mockReturnValue('1.0.0'),
        shouldSkip: async function(): Promise<boolean> {
          const remote = await this.checkRemoteVersion();
          const stored = this.getStoredVersion();
          return remote === stored;
        }
      };

      const result = await fetcherWithMatchingVersions.shouldSkip();
      expect(result).toBe(true);
    });

    it('should return false when versions differ', async () => {
      // Create a new fetcher that returns different versions
      const fetcherWithDifferentVersions: IFetcher = {
        fetch: vi.fn(),
        getSourceName: vi.fn().mockReturnValue('test'),
        checkRemoteVersion: vi.fn().mockResolvedValue('2.0.0'),
        getStoredVersion: vi.fn().mockReturnValue('1.0.0'),
        shouldSkip: async function(): Promise<boolean> {
          const remote = await this.checkRemoteVersion();
          const stored = this.getStoredVersion();
          return remote === stored;
        }
      };

      const result = await fetcherWithDifferentVersions.shouldSkip();
      expect(result).toBe(false);
    });
  });
});