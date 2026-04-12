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
 */
export class MameGroupStrategy implements IGroupStrategy {
  getStrategyName(): string {
    return 'mame-source-category';
  }

  getGroupNames(): string[] {
    return Object.values(MameCategory);
  }

  /**
   * Determine the group for a single DAT entry
   * @param dat DAT entry to categorize
   * @returns Group name
   */
  getGroup(dat: DAT): string {
    return this.determineCategory(dat);
  }

  group(dats: DAT[]): GroupedDATs {
    const grouped: GroupedDATs = {};
    for (const dat of dats) {
      const category = this.getGroup(dat);
      if (!grouped[category]) grouped[category] = [];
      grouped[category].push(dat);
    }
    return grouped;
  }

  private determineCategory(dat: DAT): string {
    const system = dat.system?.toLowerCase() || '';
    const source = dat.source?.toLowerCase() || '';

    if (system === MameCategory.ARCADE || system === 'mame-arcade' || system === 'arcade') {
      return MameCategory.ARCADE;
    }

    if (system.startsWith(MameCategory.SOFTWARE_LISTS) || 
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

    return system || MameCategory.OTHER;
  }
}
