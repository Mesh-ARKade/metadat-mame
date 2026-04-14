/**
 * Tests for MAME Grouping Strategy - 3 Artifact Model
 *
 * @intent Verify grouping into 3 artifacts: arcade, computers, consoles
 * @guarantee Each DAT is grouped by its category field (arcade/computers/consoles)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { MameGroupStrategy, MameArtifactGroup } from '../../src/strategies/mame-grouping.js';
import type { DAT } from '../../src/types/index.js';

describe('MameGroupStrategy', () => {
  let strategy: MameGroupStrategy;

  beforeEach(() => {
    strategy = new MameGroupStrategy();
  });

  describe('Group identification', () => {
    it('should identify all three artifact groups', () => {
      const groups = strategy.getGroupNames();
      expect(groups).toContain(MameArtifactGroup.ARCADE);
      expect(groups).toContain(MameArtifactGroup.COMPUTERS);
      expect(groups).toContain(MameArtifactGroup.CONSOLES);
      expect(groups).toHaveLength(3);
    });
  });

  describe('Arcade grouping', () => {
    it('should group arcade entries together', () => {
      const dats: DAT[] = [
        {
          id: 'mame:arcade:pacman',
          source: 'mame',
          system: 'arcade',
          datVersion: '2024-01-01',
          description: 'Pac-Man',
          category: 'arcade',
          roms: []
        },
        {
          id: 'mame:arcade:galaga',
          source: 'mame',
          system: 'arcade',
          datVersion: '2024-01-01',
          description: 'Galaga',
          category: 'arcade',
          roms: []
        }
      ];

      const grouped = strategy.group(dats);

      expect(grouped[MameArtifactGroup.ARCADE]).toHaveLength(2);
      expect(grouped[MameArtifactGroup.COMPUTERS]).toBeUndefined();
      expect(grouped[MameArtifactGroup.CONSOLES]).toBeUndefined();
    });
  });

  describe('Computers grouping', () => {
    it('should group computer entries together', () => {
      const dats: DAT[] = [
        {
          id: 'mame:c64:game1',
          source: 'mame',
          system: 'computers',
          datVersion: '2024-01-01',
          description: 'C64 Game',
          category: 'computers',
          roms: []
        },
        {
          id: 'mame:amiga:game2',
          source: 'mame',
          system: 'computers',
          datVersion: '2024-01-01',
          description: 'Amiga Game',
          category: 'computers',
          roms: []
        }
      ];

      const grouped = strategy.group(dats);

      expect(grouped[MameArtifactGroup.COMPUTERS]).toHaveLength(2);
      expect(grouped[MameArtifactGroup.ARCADE]).toBeUndefined();
      expect(grouped[MameArtifactGroup.CONSOLES]).toBeUndefined();
    });
  });

  describe('Consoles grouping', () => {
    it('should group console entries together', () => {
      const dats: DAT[] = [
        {
          id: 'mame:nes:smb1',
          source: 'mame',
          system: 'consoles',
          datVersion: '2024-01-01',
          description: 'Super Mario Bros.',
          category: 'consoles',
          roms: []
        },
        {
          id: 'mame:snes:zelda',
          source: 'mame',
          system: 'consoles',
          datVersion: '2024-01-01',
          description: 'Zelda',
          category: 'consoles',
          roms: []
        }
      ];

      const grouped = strategy.group(dats);

      expect(grouped[MameArtifactGroup.CONSOLES]).toHaveLength(2);
      expect(grouped[MameArtifactGroup.ARCADE]).toBeUndefined();
      expect(grouped[MameArtifactGroup.COMPUTERS]).toBeUndefined();
    });
  });

  describe('Mixed category grouping', () => {
    it('should correctly separate mixed categories into groups', () => {
      const dats: DAT[] = [
        {
          id: 'mame:arcade:pacman',
          source: 'mame',
          system: 'arcade',
          datVersion: '2024-01-01',
          description: 'Pac-Man',
          category: 'arcade',
          roms: []
        },
        {
          id: 'mame:c64:game1',
          source: 'mame',
          system: 'computers',
          datVersion: '2024-01-01',
          description: 'C64 Game',
          category: 'computers',
          roms: []
        },
        {
          id: 'mame:nes:smb1',
          source: 'mame',
          system: 'consoles',
          datVersion: '2024-01-01',
          description: 'Super Mario Bros.',
          category: 'consoles',
          roms: []
        }
      ];

      const grouped = strategy.group(dats);

      expect(Object.keys(grouped)).toHaveLength(3);
      expect(grouped[MameArtifactGroup.ARCADE]).toHaveLength(1);
      expect(grouped[MameArtifactGroup.COMPUTERS]).toHaveLength(1);
      expect(grouped[MameArtifactGroup.CONSOLES]).toHaveLength(1);
    });

    it('should handle empty input', () => {
      const grouped = strategy.group([]);
      expect(Object.keys(grouped)).toHaveLength(0);
    });

    it('should handle uncategorized entries (defaults to computers)', () => {
      const dats: DAT[] = [
        {
          id: 'mame:unknown:entry',
          source: 'mame',
          system: 'unknown',
          datVersion: '2024-01-01',
          description: 'Unknown',
          roms: []
        }
      ];

      const grouped = strategy.group(dats);
      // Uncategorized entries default to computers
      expect(grouped[MameArtifactGroup.COMPUTERS]).toHaveLength(1);
    });

    it('should use system name as fallback when category is missing', () => {
      const dats: DAT[] = [
        {
          id: 'mame:arcade:pacman',
          source: 'mame',
          system: 'arcade',
          datVersion: '2024-01-01',
          description: 'Pac-Man',
          // No category field
          roms: []
        }
      ];

      const grouped = strategy.group(dats);
      // Should fallback to system name 'arcade'
      expect(grouped[MameArtifactGroup.ARCADE]).toHaveLength(1);
    });
  });
});
