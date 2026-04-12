/**
 * ZstdCompressor - Compresses data using zstd
 *
 * @intent Compress DAT data to artifacts using zstd with optional dictionary
 * @guarantee Uses Node 22 built-in zstd support, handles large files
 *           Uses immutable dictionary from src/data/catalog.dict if available
 */

import fs from 'fs/promises';
import fsSync from 'fs';
import zlib from 'zlib';
import path from 'path';
import crypto from 'crypto';
import type { Artifact } from '../types/index.js';

// Immutable dictionary path - if this file exists, use it instead of training
const IMMUTABLE_DICT_PATH = 'src/data/catalog.dict';

/**
 * Check if immutable dictionary exists and load it
 * @returns Dictionary buffer or null if not found
 */
export async function getImmutableDictionary(): Promise<Buffer | null> {
  try {
    if (fsSync.existsSync(IMMUTABLE_DICT_PATH)) {
      console.log(`[compressor] Using immutable dictionary: ${IMMUTABLE_DICT_PATH}`);
      return await fs.readFile(IMMUTABLE_DICT_PATH);
    }
  } catch (err) {
    console.warn(`[compressor] Failed to load immutable dictionary: ${(err as Error).message}`);
  }
  return null;
}

/**
 * Check if immutable dictionary exists (sync version for quick checks)
 */
export function hasImmutableDictionary(): boolean {
  return fsSync.existsSync(IMMUTABLE_DICT_PATH);
}

/**
 * Compress content using the immutable dictionary if available
 * @param content Content to compress
 * @param outputPath Output file path
 * @returns Artifact with metadata
 */
export async function compressWithImmutableDict(
  content: string,
  outputPath: string
): Promise<Artifact> {
  const dictionary = await getImmutableDictionary();
  
  if (!dictionary) {
    // No dictionary available, use standard compression
    console.log('[compressor] No immutable dictionary found, using standard compression');
    return compress(content, outputPath);
  }
  
  // Use immutable dictionary for compression
  const contentBuffer = Buffer.from(content, 'utf-8');
  
  const compressed = zlib.zstdCompressSync(contentBuffer, {
    level: 19,
    dictionary: dictionary
  } as zlib.ZstdOptions);
  
  // Ensure output directory exists
  await fs.mkdir(path.dirname(outputPath), { recursive: true }).catch(() => {});
  
  // Write compressed file
  await fs.writeFile(outputPath, compressed);
  
  // Calculate SHA-256
  const sha256 = crypto.createHash('sha256').update(compressed).digest('hex');
  
  // Count entries
  const entryCount = content.split('\n').filter(line => line.trim().length > 0).length;
  
  return {
    name: path.basename(outputPath),
    path: outputPath,
    size: compressed.length,
    sha256,
    entryCount,
    dictionary: IMMUTABLE_DICT_PATH
  };
}

/**
 * Compress content to a .zst file using Node 22's built-in zstd
 * @param content Content to compress
 * @param outputPath Path for output file
 * @returns Artifact with metadata
 */
export async function compress(content: string, outputPath: string): Promise<Artifact> {
  const contentBuffer = Buffer.from(content, 'utf-8');
  
  // Compress using zstd (Node 22 built-in) - cast to any to bypass strict typing
  const compressed = zlib.zstdCompressSync(contentBuffer, { level: 19 } as zlib.ZstdOptions);
  
  // Ensure output directory exists
  await fs.mkdir(path.dirname(outputPath), { recursive: true }).catch(() => {});
  
  // Write compressed file
  await fs.writeFile(outputPath, compressed);
  
  // Calculate SHA-256
  const sha256 = crypto.createHash('sha256').update(compressed).digest('hex');
  
  // Count entries (newline-separated JSON)
  const entryCount = content.split('\n').filter(line => line.trim().length > 0).length;
  
  return {
    name: path.basename(outputPath),
    path: outputPath,
    size: compressed.length,
    sha256,
    entryCount
  };
}

/**
 * Decompress a .zst file back to original content
 * @param filePath Path to compressed file
 * @returns Decompressed content string
 */
export async function decompress(filePath: string): Promise<string> {
  const compressed = await fs.readFile(filePath);
  const decompressed = zlib.zstdDecompressSync(compressed);
  return decompressed.toString('utf-8');
}

/**
 * Compress content using a pre-trained dictionary
 * @param content Content to compress
 * @param outputPath Output file path
 * @param dictionaryPath Path to dictionary file
 * @returns Artifact with metadata
 */
export async function compressWithDictionary(
  content: string, 
  outputPath: string, 
  dictionaryPath: string
): Promise<Artifact> {
  const contentBuffer = Buffer.from(content, 'utf-8');
  
  // Read dictionary
  const dictionary = await fs.readFile(dictionaryPath);
  
  // Compress with dictionary using zstd
  const compressed = zlib.zstdCompressSync(contentBuffer, {
    level: 19,
    dictionary: dictionary
  } as zlib.ZstdOptions);
  
  // Ensure output directory exists
  await fs.mkdir(path.dirname(outputPath), { recursive: true }).catch(() => {});
  
  // Write compressed file
  await fs.writeFile(outputPath, compressed);
  
  // Calculate SHA-256
  const sha256 = crypto.createHash('sha256').update(compressed).digest('hex');
  
  // Count entries
  const entryCount = content.split('\n').filter(line => line.trim().length > 0).length;
  
  return {
    name: path.basename(outputPath),
    path: outputPath,
    size: compressed.length,
    sha256,
    entryCount,
    dictionary: dictionaryPath
  };
}

/**
 * Train a zstd dictionary from sample data
 * @param samples Array of sample strings
 * @param dictionaryPath Path to save dictionary file
 */
export async function trainDictionary(
  samples: string[], 
  dictionaryPath: string
): Promise<void> {
  // For dictionary training, we need the zstd CLI
  // Since Node 22 doesn't have dictionary training API, we'll use a simpler approach:
  // Collect all samples and compress them together to create a "dictionary-like" effect
  
  const combinedSamples = samples.join('\n');
  const combinedBuffer = Buffer.from(combinedSamples, 'utf-8');
  
  // Create a pseudo-dictionary by compressing samples at different levels
  // and using the compressed result as a reference
  // Note: True dictionary training requires the zstd CLI or a C++ binding
  
  // For the template, we'll note this is a simplified implementation
  // Real dictionary training would require external zstd CLI or library
  
  // For now, create a placeholder that can be used for compression tests
  const dictContent = zlib.zstdCompressSync(combinedBuffer, { level: 1 } as zlib.ZstdOptions);
  
  await fs.mkdir(path.dirname(dictionaryPath), { recursive: true }).catch(() => {});
  await fs.writeFile(dictionaryPath, dictContent);
}

/**
 * ZstdCompressor class (alternative interface)
 */
export class ZstdCompressor {
  /**
   * Compress content to file
   */
  static async compress(content: string, outputPath: string): Promise<Artifact> {
    return compress(content, outputPath);
  }

  /**
   * Decompress file to content
   */
  static async decompress(filePath: string): Promise<string> {
    return decompress(filePath);
  }

  /**
   * Compress with dictionary
   */
  static async compressWithDictionary(
    content: string, 
    outputPath: string, 
    dictionaryPath: string
  ): Promise<Artifact> {
    return compressWithDictionary(content, outputPath, dictionaryPath);
  }

  /**
   * Train dictionary from samples
   */
  static async trainDictionary(samples: string[], dictionaryPath: string): Promise<void> {
    return trainDictionary(samples, dictionaryPath);
  }
}