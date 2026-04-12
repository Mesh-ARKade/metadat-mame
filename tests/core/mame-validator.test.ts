/**
 * Tests for MAME-specific XML validation
 *
 * @intent Verify MAME XML parses correctly to DAT format
 * @guarantee All MAME metadata is preserved 1:1
 */

import { describe, it, expect } from 'vitest';
import { extractGameEntries, validateWellFormed } from '../../src/core/validator.js';

describe('MAME XML Validation', () => {
  describe('RED: Arcade machine XML', () => {
    const arcadeXml = `<?xml version="1.0"?>
<mame build="0.263 (mame0263)" debug="no" mameconfig="10">
  <machine name="pacman" sourcefile="pacman.cpp" romof="puckman" cloneof="puckman">
    <description>Pac-Man (Midway)</description>
    <year>1980</year>
    <manufacturer>Namco (Midway license)</manufacturer>
    <bios name="namco"/>
    <rom name="pacman.6e" size="4096" crc="c1e6ab10" sha1="e87e059c5be45753f7e9f33dff851f16d6751181"/>
    <rom name="pacman.6f" size="4096" crc="1a6fb2d4" sha1="674d3a7f00d8be5e38b1fdc208ebef5a92d38329"/>
    <device_ref name="z80"/>
    <sample name="eat"/>
    <sample name="death"/>
  </machine>
  <machine name="galaga" sourcefile="galaga.cpp">
    <description>Galaga (Namco rev. B)</description>
    <year>1981</year>
    <manufacturer>Namco</manufacturer>
    <rom name="gg1-1" size="4096" crc="a3a0f7d3" sha1="4b4de810d58e66f6a51d9d1a69c1e8a5a73d5a7a"/>
  </machine>
</mame>`;

    it('should validate well-formed MAME XML', () => {
      const result = validateWellFormed(arcadeXml);
      expect(result.valid).toBe(true);
    });

    it('should extract machine entries with all metadata', () => {
      const result = extractGameEntries(arcadeXml);
      expect(result.valid).toBe(true);
      expect(result.games).toHaveLength(2);
      
      // Check Pac-Man entry
      const pacman = result.games.find(g => g.name === 'pacman');
      expect(pacman).toBeDefined();
      expect(pacman?.description).toBe('Pac-Man (Midway)');
      expect(pacman?.year).toBe('1980');
      expect(pacman?.manufacturer).toBe('Namco (Midway license)');
      // Attributes are preserved 1:1 with @_ prefix
      expect(pacman?.['@_sourcefile']).toBe('pacman.cpp');
      expect(pacman?.['@_romof']).toBe('puckman');
      expect(pacman?.['@_cloneof']).toBe('puckman');
    });

    it('should preserve ROM entries with hashes', () => {
      const result = extractGameEntries(arcadeXml);
      const pacman = result.games.find(g => g.name === 'pacman');
      
      expect(pacman?.rom).toBeDefined();
      const roms = Array.isArray(pacman?.rom) ? pacman?.rom : [pacman?.rom];
      expect(roms).toHaveLength(2);
      
      const rom1 = roms?.[0];
      expect(rom1?.['@_name']).toBe('pacman.6e');
      expect(rom1?.['@_size']).toBe('4096');
      expect(rom1?.['@_crc']).toBe('c1e6ab10');
      expect(rom1?.['@_sha1']).toBe('e87e059c5be45753f7e9f33dff851f16d6751181');
    });

    it('should preserve sample entries', () => {
      const result = extractGameEntries(arcadeXml);
      const pacman = result.games.find(g => g.name === 'pacman');
      
      expect(pacman?.sample).toBeDefined();
      const samples = Array.isArray(pacman?.sample) ? pacman?.sample : [pacman?.sample];
      expect(samples?.length).toBeGreaterThanOrEqual(2);
    });
  });

describe('Software List XML', () => {
    const softwareListXml = `<?xml version="1.0"?>
<softwarelist name="nes" description="Nintendo Entertainment System cartridges">
  <software name="smb1">
    <description>Super Mario Bros.</description>
    <year>1985</year>
    <publisher>Nintendo</publisher>
    <info name="serial" value="NES-SM-USA"/>
    <sharedfeat name="cartslot" value=" nes"/>
    <part name="cart" interface="nes_cart">
      <feature name="slot" value="sxrom"/>
      <dataarea name="prg" size="131072">
        <rom name="super mario bros. (world).prg" size="131072" crc="5cf54867" sha1="9c8a1e5ebc13b1b5097b65d2c09c49c3e0b13f1f"/>
      </dataarea>
      <dataarea name="chr" size="8192">
        <rom name="super mario bros. (world).chr" size="8192" crc="867b51ad" sha1="5b47f1ad2527d7c256e953f5a2b1e3f7e8c2a6b5"/>
      </dataarea>
    </part>
  </software>
</softwarelist>`;

    it('should validate well-formed software list XML', () => {
      const result = validateWellFormed(softwareListXml);
      expect(result.valid).toBe(true);
    });

    it('should extract software entries with all metadata', () => {
      const result = extractGameEntries(softwareListXml);
      expect(result.valid).toBe(true);
      expect(result.games).toHaveLength(1);
      
      const smb = result.games[0];
      expect(smb.name).toBe('smb1');
      expect(smb.description).toBe('Super Mario Bros.');
      expect(smb.year).toBe('1985');
      expect(smb.publisher).toBe('Nintendo');
      expect(smb['@_name']).toBe('smb1');
    });

    it('should preserve part and dataarea structure', () => {
      const result = extractGameEntries(softwareListXml);
      const smb = result.games[0];
      
      expect(smb.part).toBeDefined();
      const part = Array.isArray(smb.part) ? smb.part[0] : smb.part;
      expect(part?.['@_name']).toBe('cart');
      expect(part?.['@_interface']).toBe('nes_cart');
      
      // Check dataarea
      expect(part?.dataarea).toBeDefined();
    });

    it('should preserve info tags as metadata', () => {
      const result = extractGameEntries(softwareListXml);
      const smb = result.games[0];
      
      expect(smb.info).toBeDefined();
      const infos = Array.isArray(smb.info) ? smb.info : [smb.info];
      const serial = infos?.find((i: any) => i?.['@_name'] === 'serial');
      expect(serial?.['@_value']).toBe('NES-SM-USA');
    });
  });

describe('HBMAME XML', () => {
    const hbmameXml = `<?xml version="1.0"?>
<mame build="0.263 (hbmame0263)">
  <machine name="sf2cebh1" sourcefile="cps1.cpp">
    <description>Street Fighter II: Champion Edition ( hack, bootleg set 1)</description>
    <year>1992</year>
    <manufacturer>bootleg</manufacturer>
    <rom name="sf2cebh1.23" size="524288" crc="4e9ecf80" sha1="a3b8b8f0e9c5c2b8a9e1f3b2c4d5e6f7a8b9c0d1"/>
  </machine>
</mame>`;

    it('should validate well-formed HBMAME XML', () => {
      const result = validateWellFormed(hbmameXml);
      expect(result.valid).toBe(true);
    });

    it('should extract HBMAME entries with hack/bootleg metadata', () => {
      const result = extractGameEntries(hbmameXml);
      expect(result.valid).toBe(true);
      expect(result.games).toHaveLength(1);
      
      const sf2 = result.games[0];
      expect(sf2.name).toBe('sf2cebh1');
      expect(sf2.description).toContain('hack');
      expect(sf2.manufacturer).toBe('bootleg');
    });
  });

describe('Edge cases', () => {
    it('should handle empty machine tags', () => {
      const xml = `<?xml version="1.0"?>
<mame>
  <machine name="emptytest">
    <description>Empty Test</description>
  </machine>
</mame>`;
      
      const result = extractGameEntries(xml);
      expect(result.valid).toBe(true);
      expect(result.games).toHaveLength(1);
      expect(result.games[0].name).toBe('emptytest');
    });

    it('should handle large XML without memory issues', () => {
      // Generate a moderately large XML
      let machines = '';
      for (let i = 0; i < 1000; i++) {
        machines += `
    <machine name="game${i}">
      <description>Game ${i}</description>
      <year>1980</year>
      <manufacturer>Test</manufacturer>
      <rom name="rom${i}.bin" size="65536" crc="1234abcd" sha1="abcd1234abcd1234abcd1234abcd1234abcd1234"/>
    </machine>`;
      }
      
      const largeXml = `<?xml version="1.0"?>
<mame>${machines}
</mame>`;
      
      const startTime = Date.now();
      const result = extractGameEntries(largeXml);
      const duration = Date.now() - startTime;
      
      expect(result.valid).toBe(true);
      expect(result.games).toHaveLength(1000);
      // Should parse in under 5 seconds even for 1000 entries
      expect(duration).toBeLessThan(5000);
    });

    it('should handle BIOS and device machines', () => {
      const xml = `<?xml version="1.0"?>
<mame>
  <machine name="neogeo" isbios="yes">
    <description>Neo-Geo BIOS</description>
    <year>1990</year>
    <manufacturer>SNK</manufacturer>
    <rom name="neo-p1.bin" size="131072" crc="5c23f1f6" sha1="1a5f0a6b8c9d2e3f4a5b6c7d8e9f0a1b2c3d4e5"/>
  </machine>
  <machine name="z80" isdevice="yes">
    <description>Z80 CPU</description>
    <manufacturer>Zilog</manufacturer>
  </machine>
</mame>`;
      
      const result = extractGameEntries(xml);
      expect(result.valid).toBe(true);
      expect(result.games).toHaveLength(2);
      
      const bios = result.games.find(g => g.name === 'neogeo');
      expect(bios?.['@_isbios']).toBe('yes');
      
      const device = result.games.find(g => g.name === 'z80');
      expect(device?.['@_isdevice']).toBe('yes');
    });
  });
});
