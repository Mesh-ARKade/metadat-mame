/**
 * ICompressor interface
 *
 * @intent Define the contract for compressing DAT data
 * @guarantee Implementations compress DATs to artifacts with optional dictionary training
 */

import type { DAT, Artifact } from '../types/index.js';

export interface ICompressor {
  /**
   * Compress DATs to an artifact file
   * @param dats Array of DATs to compress
   * @param outputPath Path for output artifact
   * @returns Artifact with metadata
   */
  compress(_dats: DAT[], _outputPath: string): Promise<Artifact>;

  /**
   * Train compression dictionary from sample data
   * @param samples Sample DATs to train on
   * @param dictionaryPath Path to save dictionary
   */
  trainDictionary(_samples: DAT[], _dictionaryPath: string): Promise<void>;
}