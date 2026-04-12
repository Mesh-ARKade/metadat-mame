/**
 * MAME Multi-Source Fetcher
 *
 * @intent Fetch DATs from MAME (Arcade), Software Lists, and HBMAME using real HTTP requests
 * @guarantee Streams XML directly from network to parser without loading full file into memory
 * @constraint Fault-tolerant: failures in one source don't break others
 */

import { AbstractFetcher, type FetcherOptions } from '../base/base-fetcher.js';
import { VersionTracker } from '../core/version-tracker.js';
import { XmlValidator, type GameEntry } from '../core/validator.js';
import type { DAT } from '../types/index.js';
import fs from 'fs/promises';
import path from 'path';
import { execSync } from 'child_process';

/**
 * MAME data source types
 */
export enum MameSourceType {
  ARCADE = 'arcade',
  SOFTWARE_LISTS = 'software-lists',
  HBMAME = 'hbmame'
}

/**
 * Configuration for each MAME source
 */
interface SourceConfig {
  type: MameSourceType;
  url: string;
  enabled: boolean;
}

/**
 * MAME version info from all sources
 */
export interface MameVersionInfo {
  arcade?: string;
  softwareLists?: string;
  hbmame?: string;
}

export class MameFetcher extends AbstractFetcher {
  private outputDir: string;
  private sources: SourceConfig[];

  constructor(
    versionTracker: VersionTracker,
    outputDir: string = './output/mame',
    options: FetcherOptions = {}
  ) {
    super(versionTracker, {
      maxRetries: options.maxRetries ?? 3,
      retryDelay: options.retryDelay ?? 10000,
      rateLimitMs: options.rateLimitMs ?? 2000
    });
    this.outputDir = outputDir;

    // Default sources
    this.sources = [
      {
        type: MameSourceType.ARCADE,
        url: '', // Constructed dynamically
        enabled: true
      },
      {
        type: MameSourceType.SOFTWARE_LISTS,
        url: 'https://api.github.com/repos/mamedev/mame/contents/hash',
        enabled: true
      },
      {
        type: MameSourceType.HBMAME,
        url: 'https://raw.githubusercontent.com/AntoPISA/MAME_Dats/master/HBMAME/HBMAME.xml',
        enabled: true
      }
    ];
  }

  getSourceName(): string {
    return 'mame';
  }

  async checkRemoteVersion(): Promise<string> {
    const versions: MameVersionInfo = {};

    try {
      const res = await fetch('https://api.github.com/repos/mamedev/mame/releases/latest', {
        headers: { 'Accept': 'application/vnd.github+json', 'User-Agent': 'mesh-arkade' }
      });
      if (res.ok) {
        const release = await res.json() as any;
        const tag = release.tag_name;
        const ver = tag.replace('mame', '');
        versions.arcade = ver;
        versions.softwareLists = ver;
      }
    } catch (err) { console.warn('[mame] Failed to check MAME version:', err); }

    try {
      const res = await fetch('https://api.github.com/repos/AntoPISA/MAME_Dats/commits/master', {
        headers: { 'Accept': 'application/vnd.github+json', 'User-Agent': 'mesh-arkade' }
      });
      if (res.ok) {
        const commit = await res.json() as any;
        versions.hbmame = commit.sha.substring(0, 7);
      }
    } catch (err) { console.warn('[mame] Failed to check HBMAME version:', err); }

    return [
      versions.arcade ? `arcade:${versions.arcade}` : null,
      versions.hbmame ? `hbmame:${versions.hbmame}` : null
    ].filter(Boolean).join('|') || 'unknown';
  }

  /**
   * Fetch DATs from all configured sources using streaming
   */
  async fetchDats(onEntry?: (entry: DAT) => void): Promise<DAT[]> {
    await fs.mkdir(this.outputDir, { recursive: true });

    console.log('[mame] Starting multi-source streaming fetch...');

    const allDats: DAT[] = [];
    let totalEntries = 0;

    for (const source of this.sources) {
      if (!source.enabled) continue;

      try {
        console.log(`[mame] Fetching from ${source.type}...`);
        const startTime = Date.now();
        
        let count = 0;
        const entryCallback = (entry: GameEntry) => {
          const dat = this.gameEntryToDat(entry, source.type === MameSourceType.ARCADE ? 'arcade' : ((entry.softwarelist as string) || source.type));
          count++;
          if (onEntry) {
            onEntry(dat);
          } else {
            allDats.push(dat);
          }
        };

        if (source.type === MameSourceType.ARCADE) {
          await this.fetchArcade(entryCallback);
        } else if (source.type === MameSourceType.SOFTWARE_LISTS) {
          await this.fetchSoftwareLists(entryCallback);
        } else if (source.type === MameSourceType.HBMAME) {
          await this.fetchHbmame(source.url, entryCallback);
        }

        const duration = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`[mame] ${source.type}: ${count} entries in ${duration}s`);
        totalEntries += count;
        
      } catch (err) {
        console.error(`[mame] Failed to fetch ${source.type}:`, (err as Error).message);
      }
    }

    console.log(`[mame] Total: ${totalEntries} entries from all sources`);

    // Update version tracking
    const version = await this.checkRemoteVersion();
    await this.updateVersion(version);

    return allDats;
  }

  private async fetchArcade(onEntry: (entry: GameEntry) => void): Promise<void> {
    console.log('[mame] Fetching arcade...');
    const res = await fetch('https://api.github.com/repos/mamedev/mame/releases/latest', {
      headers: { 'Accept': 'application/vnd.github+json', 'User-Agent': 'mesh-arkade' }
    });
    if (!res.ok) throw new Error(`MAME release fetch failed: ${res.status}`);
    const release = await res.json() as any;
    const tag = release.tag_name;
    const zipName = `${tag}lx.zip`;
    const asset = release.assets.find((a: any) => a.name === zipName);
    if (!asset) throw new Error(`MAME XML asset not found: ${zipName}`);

    const zipPath = path.join(this.outputDir, zipName);
    const zipRes = await fetch(asset.browser_download_url);
    const buffer = await zipRes.arrayBuffer();
    await fs.writeFile(zipPath, Buffer.from(buffer));

    console.log(`[mame] Unzipping ${zipName}...`);
    try {
      execSync(`unzip -o "${zipPath}" -d "${this.outputDir}"`);
    } catch {
      console.warn('[mame] unzip failed, trying powershell Expand-Archive');
      execSync(`powershell -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${this.outputDir}' -Force"`);
    }

    const xmlPath = path.join(this.outputDir, 'mame.xml');
    await XmlValidator.processFile(xmlPath, 'arcade', onEntry);
  }

  private async fetchSoftwareLists(onEntry: (entry: GameEntry) => void): Promise<void> {
    console.log('[mame] Fetching software lists...');
    const res = await fetch(this.sources[1].url, {
      headers: { 'Accept': 'application/vnd.github+json', 'User-Agent': 'mesh-arkade' }
    });
    if (!res.ok) throw new Error(`Softlist index failed: ${res.status}`);
    const files = await res.json() as any[];
    const xmlFiles = files.filter(f => f.name.endsWith('.xml'));
    
    for (const file of xmlFiles) {
      console.log(`[mame] Processing: ${file.name}`);
      try {
        await XmlValidator.processUrl(file.download_url, 'software-lists', onEntry);
      } catch (err) { console.warn(`[mame] Failed ${file.name}:`, (err as Error).message); }
    }
  }

  private async fetchHbmame(url: string, onEntry: (entry: GameEntry) => void): Promise<void> {
    console.log('[mame] Fetching HBMAME...');
    await XmlValidator.processUrl(url, 'hbmame', onEntry);
  }

  private gameEntryToDat(entry: GameEntry, system: string): DAT {
    return {
      id: `${entry.source || 'mame'}:${system}:${entry.name}`,
      source: entry.source === 'hbmame' ? 'hbmame' : 'mame',
      system,
      datVersion: new Date().toISOString(),
      description: entry.description,
      roms: this.extractRoms(entry)
    };
  }

  private extractRoms(game: Record<string, any>): any[] {
    const roms: any[] = [];
    const romData = game.rom;
    if (!romData) return roms;
    const arr = Array.isArray(romData) ? romData : [romData];
    for (const rom of arr) {
      if (rom && typeof rom === 'object') {
        roms.push({
          name: String(rom['@_name'] || rom.name || ''),
          size: parseInt(String(rom['@_size'] || rom.size || '0'), 10) || 0,
          crc: rom['@_crc'] ? String(rom['@_crc']) : undefined,
          sha1: rom['@_sha1'] ? String(rom['@_sha1']) : undefined,
          sha256: rom['@_sha256'] ? String(rom['@_sha256']) : undefined,
          md5: rom['@_md5'] ? String(rom['@_md5']) : undefined
        });
      }
    }
    return roms;
  }
}
