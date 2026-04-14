/**
 * MAME Grouping Strategy - 3 Artifact Model
 *
 * @intent Group MAME DATs into 3 artifacts: arcade, computers, consoles
 * @guarantee Each DAT is grouped strictly by its category (arcade/computers/consoles)
 * @constraint Groups match the fetcher categories exactly
 */

import type { DAT, GroupedDATs } from '../types/index.js';
import { IGroupStrategy } from '../contracts/igroup-strategy.js';

/**
 * MAME artifact groups
 */
export enum MameArtifactGroup {
  ARCADE = 'arcade',
  COMPUTERS = 'computers',
  CONSOLES = 'consoles'
}

/**
 * Groups MAME DATs into 3 artifacts by category
 */
export class MameGroupStrategy implements IGroupStrategy {
  getStrategyName(): string {
    return 'mame-3-artifact';
  }

  getGroupNames(): string[] {
    return [
      MameArtifactGroup.ARCADE,
      MameArtifactGroup.COMPUTERS,
      MameArtifactGroup.CONSOLES
    ];
  }

  /**
   * Determine the artifact group for a single DAT entry
   * Uses the category field set by the fetcher
   */
  getGroup(dat: DAT): string {
    const category = dat.category?.toLowerCase() || '';

    if (category === MameArtifactGroup.ARCADE) {
      return MameArtifactGroup.ARCADE;
    }

    if (category === MameArtifactGroup.COMPUTERS) {
      return MameArtifactGroup.COMPUTERS;
    }

    if (category === MameArtifactGroup.CONSOLES) {
      return MameArtifactGroup.CONSOLES;
    }

    // Fallback: check system name for legacy compatibility
    const system = dat.system?.toLowerCase() || '';

    if (system === 'arcade' || system === 'mame-arcade') {
      return MameArtifactGroup.ARCADE;
    }

    // Default to computers if uncategorized
    return MameArtifactGroup.COMPUTERS;
  }

  group(dats: DAT[]): GroupedDATs {
    const grouped: GroupedDATs = {};

    for (const dat of dats) {
      const groupName = this.getGroup(dat);
      if (!grouped[groupName]) {
        grouped[groupName] = [];
      }
      grouped[groupName].push(dat);
    }

    return grouped;
  }
}
