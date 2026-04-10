/**
 * IGroupStrategy interface
 *
 * @intent Define the contract for grouping DATs into artifacts
 * @guarantee Implementations define source-specific grouping logic
 */

import type { DAT, GroupedDATs } from '../types/index.js';

export interface IGroupStrategy {
  /**
   * Group DATs by the strategy's logic
   * @param dats Array of DATs to group
   * @returns GroupedDATs map of group names to DAT arrays
   */
  group(_dats: DAT[]): GroupedDATs;

  /**
   * Get the strategy name
   * @returns Strategy identifier
   */
  getStrategyName(): string;
}