/**
 * XmlValidator - Validates XML DAT files
 *
 * @intent Validate XML well-formedness and extract game entries
 * @guarantee Uses fast-xml-parser for fast validation
 */

import fs from 'fs/promises';
import { XMLValidator, XMLParser } from 'fast-xml-parser';

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export interface GameEntry {
  name: string;
  description?: string;
  [key: string]: unknown;
}

export interface ExtractResult {
  valid: boolean;
  games: GameEntry[];
  error?: string;
}

/**
 * Validate well-formed XML content
 * @param content XML string to validate
 * @returns ValidationResult with valid flag and optional error
 */
export function validateWellFormed(content: string): ValidationResult {
  if (!content || content.trim().length === 0) {
    return { valid: false, error: 'Empty XML content' };
  }

  const result = XMLValidator.validate(content, {
    allowBooleanAttributes: true
  });

  if (result === true) {
    return { valid: true };
  }

  return {
    valid: false,
    error: result.err.msg
  };
}

/**
 * Validate a file path containing XML
 * @param filePath Path to file
 * @returns ValidationResult
 */
export async function validateFile(filePath: string): Promise<ValidationResult> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return validateWellFormed(content);
  } catch (err) {
    return {
      valid: false,
      error: `File read error: ${(err as Error).message}`
    };
  }
}

/**
 * Check if file has valid DAT/XML extension
 * @param filePath File name to check
 * @returns ValidationResult
 */
export function checkExtension(filePath: string): ValidationResult {
  const validExtensions = ['.dat', '.DAT', '.xml', '.XML'];
  const hasExtension = validExtensions.some(ext =>
    filePath.toLowerCase().endsWith(ext)
  );

  if (!hasExtension) {
    return {
      valid: false,
      error: `File ${filePath} does not have .dat or .xml extension`
    };
  }

  return { valid: true };
}

/**
 * Extract game entries from DAT XML
 * @param content XML content
 * @returns ExtractResult with games array
 */
export function extractGameEntries(content: string): ExtractResult {
  const validation = validateWellFormed(content);
  if (!validation.valid) {
    return { valid: false, games: [], error: validation.error };
  }

  try {
    // Use fast-xml-parser to extract game entries
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      textNodeName: '#text',
      ignoreTagName: false,
      parseAttributeValue: true,
      parseTagValue: true
    });

    const parsed = parser.parse(content);

    // Handle different DAT structures
    const games: GameEntry[] = [];

    if (parsed.datafile?.game) {
      const gameData = parsed.datafile.game;
      // Handle single game or array of games
      const gameArray = Array.isArray(gameData) ? gameData : [gameData];
      for (const game of gameArray) {
        games.push({
          name: game['@_name'] || game.name,
          description: game.description,
          ...game
        });
      }
    } else if (parsed.mame?.game) {
      // Handle MAME format
      const gameData = parsed.mame.game;
      const gameArray = Array.isArray(gameData) ? gameData : [gameData];
      for (const game of gameArray) {
        games.push({
          name: game['@_name'] || game.name,
          description: game.description,
          ...game
        });
      }
    } else if (parsed.softwarelist?.software) {
      // Handle MAME Software List format
      const swData = parsed.softwarelist.software;
      const swArray = Array.isArray(swData) ? swData : [swData];
      for (const sw of swArray) {
        games.push({
          name: sw['@_name'] || sw.name,
          description: sw.description,
          ...sw
        });
      }
    }

    return { valid: true, games };
  } catch (err) {
    return {
      valid: false,
      games: [],
      error: `Parse error: ${(err as Error).message}`
    };
  }
}

/**
 * XmlValidator class (alternative interface)
 */
export class XmlValidator {
  /**
   * Validate XML content
   */
  static validate(content: string): ValidationResult {
    return validateWellFormed(content);
  }

  /**
   * Validate file
   */
  static async validateFilePath(filePath: string): Promise<ValidationResult> {
    return validateFile(filePath);
  }

  /**
   * Extract game entries
   */
  static extract(content: string): ExtractResult {
    return extractGameEntries(content);
  }
}