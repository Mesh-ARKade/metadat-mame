/**
 * Tests for MAME Grouping Strategy
 *
 * @intent Verify grouping by source category (arcade, software-lists, hbmame, multimedia)
 * @guarantee Each DAT is grouped strictly by its functional source category
 */

import { describe, it, expect } from 'vitest';
import { MameGroupStrategy } from '../../src/strategies/mame-grouping.js';
import type { DAT } from '../../src/types/index.js';

describe('MameGroupStrategy', () => {
  let strategy: MameGroupStrategy;

  beforeEach(() => {
    strategy = new MameGroupStrategy();
  });

  describe('RED: Group identification', () => {
    it('should identify all four group categories', () => {
      const groups = strategy.getGroupNames();
      expect(groups).toContain('arcade');
      expect(groups).toContain('software-lists');
      expect(groups).toContain('hbmame');
      expect(groups).toContain('multimedia');
    });
  });

describe('RED: Arcade grouping', () => {
    it('should group arcade machines together', () => {
      const dats: DAT[] = [
        {
          id: 'mame:arcade:pacman',
          source: 'mame',
          system: 'arcade',
          datVersion: '2024-01-01',
          description: 'Pac-Man',
          roms: []
        },
        {
          id: 'mame:arcade:galaga',
          source: 'mame',
          system: 'arcade',
          datVersion: '2024-01-01',
          description: 'Galaga',
          roms: []
        }
      ];

      const grouped = strategy.group(dats);
      
      expect(grouped['arcade']).toHaveLength(2);
      expect(grouped['software-lists']).toBeUndefined();
    });

    it('should include BIOS and device machines in arcade group', () => {
      const dats: DAT[] = [
        {
          id: 'mame:arcade:neogeo',
          source: 'mame',
          system: 'arcade',
          datVersion: '2024-01-01',
          description: 'Neo-Geo BIOS',
          roms: [],
          category: 'BIOS'
        },
        {
          id: 'mame:arcade:z80',
          source: 'mame',
          system: 'arcade',
          datVersion: '2024-01-01',
          description: 'Z80 CPU',
          roms: [],
          category: 'Device'
        }
      ];

      const grouped = strategy.group(dats);
      
      expect(grouped['arcade']).toHaveLength(2);
    });
  });

describe('RED: Software Lists grouping', () => {
    it('should group all software lists together', () => {
      const dats: DAT[] = [
        {
          id: 'mame:software:smb1',
          source: 'mame',
          system: 'software-lists',
          datVersion: '2024-01-01',
          description: 'Super Mario Bros.',
          roms: []
        },
        {
          id: 'mame:software:zelda',
          source: 'mame',
          system: 'software-lists',
          datVersion: '2024-01-01',
          description: 'The Legend of Zelda',
          roms: []
        }
      ];

      const grouped = strategy.group(dats);
      
      expect(grouped['software-lists']).toHaveLength(2);
      expect(grouped['arcade']).toBeUndefined();
    });

    it('should handle mixed console systems in software-lists', () => {
      const dats: DAT[] = [
        {
          id: 'mame:software:nes:smb1',
          source: 'mame',
          system: 'software-lists',
          datVersion: '2024-01-01',
          description: 'NES: Super Mario Bros.',
          roms: []
        },
        {
          id: 'mame:software:snes:zelda',
          source: 'mame',
          system: 'software-lists',
          datVersion: '2024-01-01',
          description: 'SNES: Zelda',
          roms: []
        }
      ];

      const grouped = strategy.group(dats);
      
      // Both should be in software-lists, not separated by console
      expect(grouped['software-lists']).toHaveLength(2);
    });
  });

describe('RED: HBMAME grouping', () => {
    it('should group HBMAME entries together', () => {
      const dats: DAT[] = [
        {
          id: 'hbmame:sf2cebh1',
          source: 'hbmame',
          system: 'hbmame',
          datVersion: '2024-01-01',
          description: 'Street Fighter II (hack)',
          roms: []
        },
        {
          id: 'hbmame:sf2cebh2',
          source: 'hbmame',
          system: 'hbmame',
          datVersion: '2024-01-01',
          description: 'Street Fighter II (bootleg)',
          roms: []
        }
      ];

      const grouped = strategy.group(dats);
      
      expect(grouped['hbmame']).toHaveLength(2);
      expect(grouped['arcade']).toBeUndefined();
    });
  });

describe('RED: Multimedia grouping', () => {
    it('should group samples and multimedia together', () => {
      const dats: DAT[] = [
        {
          id: 'mame:multimedia:dkong:samples',
          source: 'mame',
          system: 'multimedia',
          datVersion: '2024-01-01',
          description: 'Donkey Kong Samples',
          roms: []
        },
        {
          id: 'mame:multimedia: artwork',
          source: 'mame',
          system: 'multimedia',
          datVersion: '2024-01-01',
          description: 'MAME Artwork',
          roms: []
        }
      ];

      const grouped = strategy.group(dats);
      
      expect(grouped['multimedia']).toHaveLength(2);
    });
  });

describe('RED: Mixed source grouping', () => {
    it('should correctly separate mixed sources into groups', () => {
      const dats: DAT[] = [
        {
          id: 'mame:arcade:pacman',
          source: 'mame',
          system: 'arcade',
          datVersion: '2024-01-01',
          description: 'Pac-Man',
          roms: []
        },
        {
          id: 'mame:software:smb1',
          source: 'mame',
          system: 'software-lists',
          datVersion: '2024-01-01',
          description: 'Super Mario Bros.',
          roms: []
        },
        {
          id: 'hbmame:sf2cebh1',
          source: 'hbmame',
          system: 'hbmame',
          datVersion: '2024-01-01',
          description: 'SF2 Hack',
          roms: []
        },
        {
          id: 'mame:multimedia:samples',
          source: 'mame',
          system: 'multimedia',
          datVersion: '2024-01-01',
          description: 'Samples',
          roms: []
        }
      ];

      const grouped = strategy.group(dats);
      
      expect(Object.keys(grouped)).toHaveLength(4);
      expect(grouped['arcade']).toHaveLength(1);
      expect(grouped['software-lists']).toHaveLength(1);
      expect(grouped['hbmame']).toHaveLength(1);
      expect(grouped['multimedia']).toHaveLength(1);
    });

    it('should handle empty input', () => {
      const grouped = strategy.group([]);
      expect(Object.keys(grouped)).toHaveLength(0);
    });

    it('should handle unknown systems gracefully', () => {
      const dats: DAT[] = [
        {
          id: 'unknown:entry',
          source: 'unknown',
          system: 'unknown-system',
          datVersion: '2024-01-01',
          description: 'Unknown',
          roms: []
        }
      ];

      // Should not throw, put in 'other' group
      const grouped = strategy.group(dats);
      expect(grouped['other'] || grouped['unknown-system']).toBeDefined();
    });
  });
});
