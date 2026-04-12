/**
 * Tests for pipeline state validation in metadat-template
 *
 * @intent Verify pipeline state Zod schemas validate correctly
 * @guarantee Invalid states are rejected, valid states pass
 */

import { describe, it, expect } from 'vitest';
import {
  RomEntrySchema,
  DATSchema,
  ArtifactSchema,
  FetchPhaseStateSchema,
  GroupPhaseStateSchema,
  CompressPhaseStateSchema,
  PipelineStateSchema,
  validatePipelineState
} from '../../src/types/index.js';

describe('Pipeline State Zod Schemas (metadat-template)', () => {
  describe('DATSchema', () => {
    it('should validate a valid DAT', () => {
      const valid = {
        id: 'nintendo:Super Mario Bros',
        source: 'no-intro',
        system: 'Nintendo - NES',
        datVersion: '2024-01-01T00:00:00.000Z',
        roms: [{ name: 'game.nes', size: 40960 }]
      };
      expect(() => DATSchema.parse(valid)).not.toThrow();
    });

    it('should reject missing required fields', () => {
      const invalid = { id: 'test' };
      expect(() => DATSchema.parse(invalid)).toThrow();
    });
  });

  describe('PipelineStateSchema', () => {
    it('should validate fetch phase state', () => {
      const valid = {
        phase: 'fetch',
        source: 'no-intro',
        dats: [{
          id: 'test',
          source: 'no-intro',
          system: 'NES',
          datVersion: '2024-01-01T00:00:00.000Z',
          roms: []
        }]
      };
      expect(() => PipelineStateSchema.parse(valid)).not.toThrow();
    });

    it('should reject invalid phase', () => {
      const invalid = { phase: 'invalid', source: 'no-intro' };
      expect(() => PipelineStateSchema.parse(invalid)).toThrow();
    });
  });

  describe('validatePipelineState', () => {
    it('should not throw on valid state', () => {
      const valid = { phase: 'fetch', source: 'no-intro', dats: [] };
      expect(() => validatePipelineState(valid)).not.toThrow();
    });
  });
});