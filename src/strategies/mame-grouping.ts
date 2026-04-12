/**
 * MAME Grouping Strategy
 *
 * @intent Group MAME DATs by functional source category
 * @guarantee Items grouped strictly by source: arcade, software-lists, hbmame, multimedia
 * @constraint Does NOT group by manufacturer — groups by source category only
 */

import type { DAT, GroupedDATs } from '../types/index.js';
import { IGroupStrategy } from '../contracts/igroup-strategy.js';

/**
 * MAME source categories for functional grouping
 */
export enum MameCategory {
  ARCADE = 'arcade',
  SOFTWARE_LISTS = 'software-lists',
  HBMAME = 'hbmame',
  MULTIMEDIA = 'multimedia',
  OTHER = 'other'
}

/**
 * Groups MAME DATs by their source category
 *
 * Unlike No-Intro which groups by manufacturer, MAME groups by data source:
 * - arcade: MAME arcade machines, BIOS, devices
 * - software-lists: Console/computer software lists
 * - hbmame: HBMAME homebrew entries
 * - multimedia: Samples, artwork, and other assets
 */
export class MameGroupStrategy implements IGroupStrategy {
  /**
   * Get strategy identifier
   */
  getStrategyName(): string {
    return 'mame-source-category';
  }

  /**
   * Get all group names this strategy can produce
   */
  getGroupNames(): string[] {
    return Object.values(MameCategory);
  }

  /**
   * Group DATs by their source category
   *
   * @param dats Array of DAT entries to group
   * @returns GroupedDATs with categories as keys
   */
  group(dats: DAT[]): GroupedDATs {
    const grouped: GroupedDATs = {};

    for (const dat of dats) {
      const category = this.determineCategory(dat);
      
      if (!grouped[category]) {
        grouped[category] = [];
      }
      
      grouped[category].push(dat);
    }

    return grouped;
  }

  /**
   * Determine the category for a DAT entry
   *
   * Uses the `system` field primarily, falling back to `source`
   *
   * @param dat DAT entry to categorize
   * @returns Category string
   */
  private determineCategory(dat: DAT): string {
    // Use system field as primary indicator
    const system = dat.system?.toLowerCase() || '';
    const source = dat.source?.toLowerCase() || '';

    // Check for exact matches first
    if (system === MameCategory.ARCADE || system === 'mame-arcade') {
      return MameCategory.ARCADE;
    }

    if (system === MameCategory.SOFTWARE_LISTS || 
        system === 'softwarelists' ||
        system === 'software') {
      return MameCategory.SOFTWARE_LISTS;
    }

    if (system === MameCategory.HBMAME || source === 'hbmame') {
      return MameCategory.HBMAME;
    }

    if (system === MameCategory.MULTIMEDIA ||
        system === 'samples' ||
        system === 'artwork' ||
        system === 'devices') {
      return MameCategory.MULTIMEDIA;
    }

    // Check source for hbmame
    if (source === 'hbmame') {
      return MameCategory.HBMAME;
    }

    // If source is mame but no specific system, default to arcade
    if (source === 'mame') {
      return MameCategory.ARCADE;
    }

    // Unknown - use the system name or 'other'
    return system || MameCategory.OTHER;
  }
}
