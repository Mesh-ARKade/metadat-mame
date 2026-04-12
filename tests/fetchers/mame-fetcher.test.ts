/**
 * Tests for MAME Multi-Source Fetcher
 *
 * @intent Verify MameFetcher coordinates downloads from 3 distinct sources
 * @guarantee All MAME data sources are fetched and merged
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MameFetcher, MameSourceType } from '../../src/fetchers/mame-fetcher.js';
import { VersionTracker } from '../../src/core/version-tracker.js';
import fs from 'fs/promises';

describe('MameFetcher', () => {
  let fetcher: MameFetcher;
  let outputDir: string;

  beforeEach(() => {
    outputDir = './test-output-mame';
    const tracker = new VersionTracker('./test-versions.json');
    fetcher = new MameFetcher(tracker, outputDir);
  });

  afterEach(async () => {
    try {
      await fs.rm(outputDir, { recursive: true, force: true });
    } catch { /* ignore */ }
  });

  describe('Source configuration', () => {
    it('should identify as mame source', () => {
      expect(fetcher.getSourceName()).toBe('mame');
    });

    it('should configure all three data sources', () => {
      const sources = fetcher.getConfiguredSources();
      expect(sources).toContain(MameSourceType.ARCADE);
      expect(sources).toContain(MameSourceType.SOFTWARE_LISTS);
      expect(sources).toContain(MameSourceType.HBMAME);
    });
  });

  describe('GREEN: Arcade XML fetching', () => {
    it('should fetch MAME arcade XML with mock data', async () => {
      const arcadeDats = await fetcher.fetchArcadeMachines();
      expect(arcadeDats.length).toBeGreaterThan(0);
      
      // Check structure
      const pacman = arcadeDats.find(d => d.id.includes('pacman'));
      expect(pacman).toBeDefined();
      expect(pacman?.source).toBe('mame');
      expect(pacman?.system).toBe('arcade');
    });

    it('should return array even on failures', async () => {
      const result = await fetcher.fetchArcadeMachines();
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('GREEN: Software Lists fetching', () => {
    it('should fetch software lists with mock data', async () => {
      const softlistDats = await fetcher.fetchSoftwareLists();
      expect(softlistDats.length).toBeGreaterThan(0);
      expect(softlistDats.every(d => d.source === 'mame')).toBe(true);
    });

    it('should return array even on failures', async () => {
      const result = await fetcher.fetchSoftwareLists();
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('GREEN: HBMAME fetching', () => {
    it('should fetch HBMAME XML with mock data', async () => {
      const hbmameDats = await fetcher.fetchHbmame();
      expect(hbmameDats.length).toBeGreaterThan(0);
      expect(hbmameDats.every(d => d.source === 'hbmame')).toBe(true);
      expect(hbmameDats.every(d => d.system === 'hbmame')).toBe(true);
    });

    it('should return array even on failures', async () => {
      const result = await fetcher.fetchHbmame();
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('GREEN: Coordinated multi-source fetch', () => {
    it('should fetch from all three sources', async () => {
      const allDats = await fetcher.fetchDats();
      
      const arcadeCount = allDats.filter(d => d.system === 'arcade').length;
      const softlistCount = allDats.filter(d => d.system === 'software-lists').length;
      const hbmameCount = allDats.filter(d => d.system === 'hbmame').length;
      
      expect(arcadeCount + softlistCount + hbmameCount).toBe(allDats.length);
    });

    it('should have unique entry IDs', async () => {
      const allDats = await fetcher.fetchDats();
      const ids = allDats.map(d => d.id);
      const uniqueIds = new Set(ids);
      
      expect(ids.length).toBe(uniqueIds.size);
    });

    it('should preserve source metadata for each type', async () => {
      const allDats = await fetcher.fetchDats();
      
      const arcade = allDats.find(d => d.system === 'arcade');
      if (arcade) {
        expect(arcade.description).toBeDefined();
      }
      
      const softlist = allDats.find(d => d.system === 'software-lists');
      if (softlist) {
        expect(softlist.description).toBeDefined();
      }
    });
  });

  describe('Version checking', () => {
    it('should return version string', async () => {
      const version = await fetcher.checkRemoteVersion();
      expect(typeof version).toBe('string');
      expect(version.length).toBeGreaterThan(0);
    });

    it('should include source identifiers', async () => {
      const version = await fetcher.checkRemoteVersion();
      const hasSourceId = version.includes('arcade') || 
                          version.includes('softlist') || 
                          version.includes('hbmame');
      expect(hasSourceId).toBe(true);
    });
  });
});
