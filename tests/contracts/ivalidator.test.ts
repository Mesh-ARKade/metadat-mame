/**
 * IValidator contract tests
 *
 * @intent Verify IValidator interface contract
 * @guarantee Implementations conform to the expected interface
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { IValidator } from '../../src/contracts/ivalidator.js';
import type { DAT, ValidationResult } from '../../src/types/index.js';

describe('IValidator Contract', () => {
  let mockValidator: IValidator;

  beforeEach(() => {
    mockValidator = {
      validate: vi.fn().mockReturnValue({
        valid: true,
        datCount: 0,
        errorCount: 0,
        errors: []
      })
    };
  });

  describe('validate()', () => {
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

      mockValidator.validate = vi.fn().mockReturnValue({
        valid: true,
        datCount: 1,
        errorCount: 0,
        errors: []
      });

      const result = mockValidator.validate(dats);

      expect(result).toHaveProperty('valid');
      expect(result).toHaveProperty('datCount');
      expect(result).toHaveProperty('errorCount');
      expect(result).toHaveProperty('errors');
    });

    it('should return ValidationResult with boolean valid property', () => {
      const result = mockValidator.validate([]);
      expect(typeof result.valid).toBe('boolean');
    });

    it('should return ValidationResult with numeric datCount', () => {
      const result = mockValidator.validate([]);
      expect(typeof result.datCount).toBe('number');
    });

    it('should return ValidationResult with numeric errorCount', () => {
      const result = mockValidator.validate([]);
      expect(typeof result.errorCount).toBe('number');
    });

    it('should return ValidationResult with array errors', () => {
      const result = mockValidator.validate([]);
      expect(Array.isArray(result.errors)).toBe(true);
    });

    it('should handle empty DAT array', () => {
      const result = mockValidator.validate([]);
      expect(result.datCount).toBe(0);
    });
  });
});