/**
 * IValidator interface
 *
 * @intent Define the contract for validating DAT files
 * @guarantee Implementations validate DATs and return validation results
 */

import type { DAT, ValidationResult } from '../types/index.js';

export interface IValidator {
  /**
   * Validate an array of DAT objects
   * @param dats Array of DATs to validate
   * @returns ValidationResult with pass/fail status and any errors
   */
  validate(dats: DAT[]): ValidationResult;
}