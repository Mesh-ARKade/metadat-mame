/**
 * ICompressor contract tests
 *
 * @intent Verify ICompressor interface contract
 * @guarantee Implementations conform to the expected interface
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ICompressor } from '../../src/contracts/icompressor.js';
import type { DAT, Artifact } from '../../src/types/index.js';

describe('ICompressor Contract', () => {
  let mockCompressor: ICompressor;

  beforeEach(() => {
    mockCompressor = {
      compress: vi.fn().mockResolvedValue({
        name: 'test.jsonl.zst',
        path: '/tmp/test.jsonl.zst',
        size: 1000,
        sha256: 'abc123',
        entryCount: 10
      }),
      trainDictionary: vi.fn().mockResolvedValue(undefined)
    };
  });

  describe('compress()', () => {
    it('should accept DAT array and outputPath', async () => {
      const dats: DAT[] = [
        {
          id: 'test-1',
          source: 'test-source',
          system: 'Test System',
          datVersion: '1.0.0',
          roms: []
        }
      ];
      const outputPath = '/tmp/test.jsonl.zst';

      const result = await mockCompressor.compress(dats, outputPath);

      expect(result).toHaveProperty('name');
      expect(result).toHaveProperty('path');
      expect(result).toHaveProperty('size');
      expect(result).toHaveProperty('sha256');
      expect(result).toHaveProperty('entryCount');
    });

    it('should return an Artifact', async () => {
      const result = await mockCompressor.compress([], '/tmp/test.jsonl.zst');

      expect(result.name).toBeDefined();
      expect(result.path).toBeDefined();
      expect(typeof result.size).toBe('number');
      expect(typeof result.sha256).toBe('string');
      expect(typeof result.entryCount).toBe('number');
    });

    it('should be async', async () => {
      const result = mockCompressor.compress([], '/tmp/test.jsonl.zst');
      expect(result).toBeInstanceOf(Promise);
    });
  });

  describe('trainDictionary()', () => {
    it('should accept samples and dictionaryPath', async () => {
      const dats: DAT[] = [];
      const dictionaryPath = '/tmp/dict';

      await mockCompressor.trainDictionary(dats, dictionaryPath);

      expect(mockCompressor.trainDictionary).toHaveBeenCalledWith(dats, dictionaryPath);
    });

    it('should be async', () => {
      const result = mockCompressor.trainDictionary([], '/tmp/dict');
      expect(result).toBeInstanceOf(Promise);
    });
  });
});