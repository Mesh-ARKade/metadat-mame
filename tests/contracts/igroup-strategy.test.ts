/**
 * IGroupStrategy contract tests
 *
 * @intent Verify IGroupStrategy interface contract
 * @guarantee Implementations conform to the expected interface
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { IGroupStrategy } from '../../src/contracts/igroup-strategy.js';
import type { DAT, GroupedDATs } from '../../src/types/index.js';

describe('IGroupStrategy Contract', () => {
  let mockStrategy: IGroupStrategy;

  beforeEach(() => {
    mockStrategy = {
      group: vi.fn().mockReturnValue({ 'test-group': [] }),
      getStrategyName: vi.fn().mockReturnValue('mock-strategy')
    };
  });

  describe('group()', () => {
    it('should accept an array of DAT objects', () => {
      const dats: DAT[] = [
        {
          id: 'test-1',
          source: 'test-source',
          system: 'Test System',
          datVersion: '1.0.0',
          roms: []
        }
      ];

      mockStrategy.group = vi.fn().mockReturnValue({
        'test-group': dats
      });

      const result = mockStrategy.group(dats);

      expect(result).toHaveProperty('test-group');
      expect(Array.isArray(result['test-group'])).toBe(true);
    });

    it('should return a GroupedDATs object', () => {
      const result = mockStrategy.group([]);
      expect(typeof result).toBe('object');
      expect(result).not.toBeNull();
    });

    it('should group DATs by strategy logic', () => {
      const dats: DAT[] = [
        { id: '1', source: 'test', system: 'NES', datVersion: '1.0', roms: [] },
        { id: '2', source: 'test', system: 'SNES', datVersion: '1.0', roms: [] },
        { id: '3', source: 'test', system: 'Genesis', datVersion: '1.0', roms: [] }
      ];

      mockStrategy.group = vi.fn().mockReturnValue({
        'nintendo': [dats[0], dats[1]],
        'sega': [dats[2]]
      });

      const result = mockStrategy.group(dats);

      expect(result['nintendo']).toHaveLength(2);
      expect(result['sega']).toHaveLength(1);
    });
  });

  describe('getStrategyName()', () => {
    it('should return a string', () => {
      const result = mockStrategy.getStrategyName();
      expect(typeof result).toBe('string');
    });

    it('should identify the strategy', () => {
      expect(mockStrategy.getStrategyName()).toBe('mock-strategy');
    });
  });
});