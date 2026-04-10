/**
 * XmlValidator tests
 *
 * @intent Verify XmlValidator correctly validates XML content
 * @guarantee Accepts well-formed XML, rejects malformed XML, extracts entries
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { XMLValidator } from 'fast-xml-parser';

describe('XmlValidator', () => {
  let validator: typeof import('../../src/core/validator.js');

  beforeEach(async () => {
    validator = await import('../../src/core/validator.js');
  });

  describe('validateWellFormed()', () => {
    it('should accept well-formed XML', () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<data>
  <game name="Test Game">
    <rom name="test.bin" size="1024" />
  </game>
</data>`;

      const result = validator.validateWellFormed(xml);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should reject malformed XML (unclosed tag)', () => {
      // Truly malformed - unclosed <description> tag
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<data>
  <game name="Test Game">
    <description>Test
  </game>
</data>`;

      const result = validator.validateWellFormed(xml);
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should reject malformed XML (mismatched tags)', () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<data>
  <game name="Test">
    <rom name="test.bin" />
  </data>
</game>`;

      const result = validator.validateWellFormed(xml);
      expect(result.valid).toBe(false);
    });

    it('should reject non-XML content', () => {
      const xml = 'This is not XML content at all!';

      const result = validator.validateWellFormed(xml);
      expect(result.valid).toBe(false);
    });

    it('should reject empty string', () => {
      const xml = '';

      const result = validator.validateWellFormed(xml);
      expect(result.valid).toBe(false);
    });
  });

  describe('validateFile()', () => {
    it('should validate a file path with valid XML', async () => {
      const result = await validator.validateFile('tests/fixtures/valid.dat');

      expect(result.valid).toBe(true);
    });

    it('should return error for non-existent file', async () => {
      const result = await validator.validateFile('tests/fixtures/non-existent.dat');

      expect(result.valid).toBe(false);
      expect(result.error).toContain('ENOENT');
    });

    it('should return error for malformed XML file', async () => {
      const result = await validator.validateFile('tests/fixtures/invalid.dat');

      expect(result.valid).toBe(false);
    });
  });

  describe('checkExtension()', () => {
    it('should accept .dat files', () => {
      const result = validator.checkExtension('game.dat');
      expect(result.valid).toBe(true);
    });

    it('should accept .DAT files (case insensitive)', () => {
      const result = validator.checkExtension('game.DAT');
      expect(result.valid).toBe(true);
    });

    it('should accept .xml files', () => {
      const result = validator.checkExtension('mame.xml');
      expect(result.valid).toBe(true);
    });

    it('should reject .txt files', () => {
      const result = validator.checkExtension('game.txt');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('.dat');
    });

    it('should reject files without extension', () => {
      const result = validator.checkExtension('game');
      expect(result.valid).toBe(false);
    });
  });

  describe('extractGameEntries()', () => {
    it('should extract game entries from DAT structure', () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<datafile>
  <header>
    <name>Test System</name>
  </header>
  <game name="Game 1">
    <description>Test Game 1</description>
  </game>
  <game name="Game 2">
    <description>Test Game 2</description>
  </game>
</datafile>`;

      const result = validator.extractGameEntries(xml);

      expect(result.valid).toBe(true);
      expect(result.games).toHaveLength(2);
      expect(result.games[0].name).toBe('Game 1');
      expect(result.games[1].name).toBe('Game 2');
    });

    it('should handle empty datafile', () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<datafile>
  <header>
    <name>Test</name>
  </header>
</datafile>`;

      const result = validator.extractGameEntries(xml);

      expect(result.valid).toBe(true);
      expect(result.games).toHaveLength(0);
    });

    it('should return error for malformed XML', () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<datafile>
  <game name="Game 1">
`;

      const result = validator.extractGameEntries(xml);

      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });
  });
});