/**
 * Example: No-Intro Grouping Strategy
 *
 * Groups DATs by manufacturer for artifact bundling.
 * This keeps artifact count under the 1,000 limit.
 */

import type { DAT, GroupedDATs } from '../src/types/index.js';
import { IGroupStrategy } from '../src/contracts/igroup-strategy.js';

/**
 * Manufacturer mapping for No-Intro systems
 */
const MANUFACTURER_MAP: Record<string, string> = {
  // Nintendo
  'Nintendo - Game Boy': 'nintendo',
  'Nintendo - Game Boy Color': 'nintendo',
  'Nintendo - Game Boy Advance': 'nintendo',
  'Nintendo - Nintendo 64': 'nintendo',
  'Nintendo - Nintendo DS': 'nintendo',
  'Nintendo - Nintendo Entertainment System': 'nintendo',
  'Nintendo - Super Nintendo': 'nintendo',
  'Nintendo - Wii': 'nintendo',
  'Nintendo - Wii U': 'nintendo',
  'Nintendo - GameCube': 'nintendo',
  
  // Sega
  'Sega - Game Gear': 'sega',
  'Sega - Master System': 'sega',
  'Sega - Mega Drive': 'sega',
  'Sega - Saturn': 'sega',
  'Sega - Dreamcast': 'sega',
  'Sega - Genesis': 'sega',
  
  // Sony
  'Sony - PlayStation': 'sony',
  'Sony - PlayStation 2': 'sony',
  'Sony - PlayStation Portable': 'sony',
  
  // Other
  'Atari - Atari 2600': 'other',
  'Atari - Atari 7800': 'other',
  'NEC - PC Engine': 'other',
  'NEC - PC-FX': 'other',
};

/**
 * No-Intro Grouping Strategy
 * Groups systems by manufacturer to reduce artifact count
 */
export class NoIntroGroupStrategy implements IGroupStrategy {
  /**
   * Group DATs by manufacturer
   */
  group(dats: DAT[]): GroupedDATs {
    const groups: GroupedDATs = {};
    
    for (const dat of dats) {
      const manufacturer = this.getManufacturer(dat.system);
      
      if (!groups[manufacturer]) {
        groups[manufacturer] = [];
      }
      
      groups[manufacturer].push(dat);
    }
    
    return groups;
  }
  
  /**
   * Get manufacturer for a system
   */
  private getManufacturer(systemName: string): string {
    // Try exact match first
    if (MANUFACTURER_MAP[systemName]) {
      return MANUFACTURER_MAP[systemName];
    }
    
    // Try prefix match
    for (const [prefix, manufacturer] of Object.entries(MANUFACTURER_MAP)) {
      if (systemName.startsWith(prefix.split(' - ')[0])) {
        return manufacturer;
      }
    }
    
    // Default to 'other'
    return 'other';
  }
  
  /**
   * Get strategy name
   */
  getStrategyName(): string {
    return 'nointro-manufacturer';
  }
}

/**
 * Example artifact names this produces:
 * - nointro--nintendo.jsonl.zst (NES, SNES, GB, GBA, N64, etc.)
 * - nointro--sega.jsonl.zst (Genesis, Saturn, Dreamcast, etc.)
 * - nointro--sony.jsonl.zst (PS1, PS2, PSP)
 * - nointro--other.jsonl.zst (Atari, NEC, etc.)
 */