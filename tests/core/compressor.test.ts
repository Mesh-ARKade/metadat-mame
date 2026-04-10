/**
 * ZstdCompressor tests
 *
 * @intent Verify ZstdCompressor correctly compresses data using zstd
 * @guarantee Compresses to file, supports dictionary training, verifies integrity
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import os from 'os';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('ZstdCompressor', () => {
  let compressor: typeof import('../../src/core/compressor.js');
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'metadat-test-'));
    compressor = await import('../../src/core/compressor.js');
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  });

  describe('compress()', () => {
    it('should compress JSONL string to .zst file', async () => {
      const jsonlContent = JSON.stringify({ id: '1', name: 'Test Game' }) + '\n';
      const outputPath = path.join(tempDir, 'test.jsonl.zst');

      const result = await compressor.compress(jsonlContent, outputPath);

      expect(result.name).toBe('test.jsonl.zst');
      expect(result.path).toBe(outputPath);
      expect(result.size).toBeGreaterThan(0);
      expect(result.sha256).toBeDefined();
      expect(result.sha256.length).toBe(64); // SHA-256 hex length
    });

    it('should create a smaller file than original', async () => {
      // Create larger content that should compress well
      const jsonlContent = Array(100).fill(null).map((_, i) =>
        JSON.stringify({ id: `${i}`, name: `Game ${i}`, description: 'Lorem ipsum dolor sit amet '.repeat(10) })
      ).join('\n');
      
      const outputPath = path.join(tempDir, 'large.jsonl.zst');

      const result = await compressor.compress(jsonlContent, outputPath);

      // Compressed should be smaller than original
      expect(result.size).toBeLessThan(Buffer.byteLength(jsonlContent, 'utf-8'));
    });

    it('should include entry count in result', async () => {
      const jsonlContent = '{\"id\":\"1\"}\n{\"id\":\"2\"}\n{\"id\":\"3\"}\n';
      const outputPath = path.join(tempDir, 'entries.jsonl.zst');

      const result = await compressor.compress(jsonlContent, outputPath);

      expect(result.entryCount).toBe(3);
    });
  });

  describe('decompress()', () => {
    it('should decompress a .zst file back to original', async () => {
      const originalContent = 'test content\nline 2\nline 3';
      const compressedPath = path.join(tempDir, 'test.zst');

      await compressor.compress(originalContent, compressedPath);
      const decompressed = await compressor.decompress(compressedPath);

      expect(decompressed).toBe(originalContent);
    });

    it('should handle empty content', async () => {
      const compressedPath = path.join(tempDir, 'empty.zst');

      await compressor.compress('', compressedPath);
      const decompressed = await compressor.decompress(compressedPath);

      expect(decompressed).toBe('');
    });
  });

  describe('compressWithDictionary()', () => {
    it('should compress using a pre-trained dictionary', async () => {
      const content = 'sample data for compression with dictionary'.repeat(50);
      const dictPath = path.join(tempDir, 'dict.zst');
      const compressedPath = path.join(tempDir, 'compressed.zst');

      // First create a dictionary from sample data
      await compressor.trainDictionary([content], dictPath);

      // Compress with the dictionary
      const result = await compressor.compressWithDictionary(content, compressedPath, dictPath);

      expect(result.sha256).toBeDefined();
    });
  });

  describe('trainDictionary()', () => {
    it('should create a dictionary file from samples', async () => {
      const samples = [
        'sample content 1 with various words',
        'sample content 2 different data here',
        'sample content 3 more variations'
      ];
      const dictPath = path.join(tempDir, 'test-dict.zst');

      await compressor.trainDictionary(samples, dictPath);

      // Check that file exists and has content
      const stats = await fs.stat(dictPath);
      expect(stats.size).toBeGreaterThan(0);
    });
  });

  describe('roundtrip', () => {
    it('should maintain data integrity through compress/decompress', async () => {
      const originalData = JSON.stringify({
        games: Array(1000).fill(null).map((_, i) => ({
          id: `game-${i}`,
          name: `Game ${i}`,
          roms: [{ name: `rom${i}.bin`, size: 1024 * (i + 1) }]
        }))
      });

      const compressedPath = path.join(tempDir, 'roundtrip.jsonl.zst');
      
      await compressor.compress(originalData, compressedPath);
      const decompressed = await compressor.decompress(compressedPath);

      expect(decompressed).toBe(originalData);
    });
  });
});