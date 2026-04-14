/**
 * MAME Fetcher - GitHub Primary + ProgettoSnaps Fallback
 *
 * @intent Fetch MAME DATs from mamedev/mame GitHub repo (computers/consoles) and ProgettoSnaps (arcade)
 * @guarantee Returns all MAME DATs categorized into 3 groups: arcade, computers, consoles
 * @constraint No Playwright - uses direct HTTP and GitHub API only
 */

import fs from 'fs/promises';
import path from 'path';
import { AbstractFetcher, type FetcherOptions } from '../base/base-fetcher.js';
import { VersionTracker } from '../core/version-tracker.js';
import type { DAT, RomEntry } from '../types/index.js';
import { extractGameEntries } from '../core/validator.js';

/**
 * MAME GitHub repository info
 */
const MAME_REPO = {
  owner: 'mamedev',
  repo: 'mame',
  hashPath: 'hash'
};

/**
 * ProgettoSnaps arcade DAT URL
 * Direct download of the latest MAME arcade DAT
 */
const PROGETTO_ARCADE_URL = 'https://www.progettosnaps.net/download/?tipo=dat_mame&file=/dats/MAME/MAME.dat';

/**
 * MAME system categories for hash/ XML files
 */
export enum MameSystemCategory {
  ARCADE = 'arcade',
  COMPUTERS = 'computers',
  CONSOLES = 'consoles'
}

/**
 * Fetches MAME DATs from GitHub (primary) and ProgettoSnaps (arcade)
 */
export class MameFetcher extends AbstractFetcher {
  private outputDir: string;
  private apiToken: string | undefined;

  constructor(
    versionTracker: VersionTracker,
    outputDir: string = './output/mame',
    options: FetcherOptions = {}
  ) {
    super(versionTracker, {
      maxRetries: options.maxRetries ?? 3,
      retryDelay: options.retryDelay ?? 5000,
      rateLimitMs: options.rateLimitMs ?? 500 // Be nice to GitHub API
    });
    this.outputDir = outputDir;
    this.apiToken = process.env.GITHUB_TOKEN;
  }

  getSourceName(): string {
    return 'mame';
  }

  /**
   * Check remote version using MAME GitHub releases
   * @returns Latest release tag (e.g., "mame0287")
   */
  async checkRemoteVersion(): Promise<string> {
    const url = `https://api.github.com/repos/${MAME_REPO.owner}/${MAME_REPO.repo}/releases/latest`;
    const response = await this.fetchWithRetry(url);
    const data = await response.json() as { tag_name: string };
    return data.tag_name;
  }

  /**
   * Fetch all MAME DATs
   * - Arcade: From ProgettoSnaps (single DAT file)
   * - Computers/Consoles: From mamedev/mame hash/ directory
   */
  async fetchDats(onEntry?: (dat: DAT) => void): Promise<DAT[]> {
    await fs.mkdir(this.outputDir, { recursive: true });

    const version = await this.checkRemoteVersion();
    console.log(`[mame] MAME version: ${version}`);

    const dats: DAT[] = [];

    // Fetch arcade DAT from ProgettoSnaps
    console.log('[mame] Fetching arcade DAT from ProgettoSnaps...');
    const arcadeDats = await this.fetchArcadeDats(version);
    for (const dat of arcadeDats) {
      dats.push(dat);
      onEntry?.(dat);
    }

    // Fetch hash/ XMLs from GitHub
    console.log('[mame] Fetching software list XMLs from GitHub...');
    const hashDats = await this.fetchHashDats(version, onEntry);
    dats.push(...hashDats);

    console.log(`[mame] Total DATs fetched: ${dats.length}`);

    // Update version tracking
    await this.updateVersion(version);

    return dats;
  }

  /**
   * Fetch arcade DAT from ProgettoSnaps
   * Returns single DAT marked as arcade category
   */
  private async fetchArcadeDats(version: string): Promise<DAT[]> {
    const response = await this.fetchWithRetry(PROGETTO_ARCADE_URL);
    const content = await response.text();

    const result = extractGameEntries(content);
    if (!result.valid || result.games.length === 0) {
      console.warn('[mame] Arcade DAT parse failed or empty');
      return [];
    }

    const dats: DAT[] = [];
    for (const game of result.games) {
      const roms = extractRomsFromGame(game);
      const dat: DAT = {
        id: `mame-arcade:${game.name}`,
        source: 'mame',
        system: MameSystemCategory.ARCADE,
        datVersion: version,
        description: game.description || game.name,
        category: MameSystemCategory.ARCADE,
        roms
      };
      dats.push(dat);
    }

    console.log(`[mame] Arcade DAT: ${dats.length} entries`);
    return dats;
  }

  /**
   * Fetch all XML files from mamedev/mame hash/ directory
   * Categorizes each into computers or consoles
   */
  private async fetchHashDats(version: string, onEntry?: (dat: DAT) => void): Promise<DAT[]> {
    // Get list of XML files from hash/ directory
    const xmlFiles = await this.listHashFiles();
    console.log(`[mame] Found ${xmlFiles.length} XML files in hash/`);

    const dats: DAT[] = [];
    let processed = 0;

    for (const filename of xmlFiles) {
      try {
        const category = categorizeHashFile(filename);
        const url = `https://raw.githubusercontent.com/${MAME_REPO.owner}/${MAME_REPO.repo}/master/hash/${filename}`;

        const response = await this.fetchWithRetry(url);
        const content = await response.text();

        const result = extractGameEntries(content);
        if (!result.valid || result.games.length === 0) continue;

        for (const game of result.games) {
          const roms = extractRomsFromGame(game);
          const dat: DAT = {
            id: `${filename.replace('.xml', '')}:${game.name}`,
            source: 'mame',
            system: category, // computers or consoles
            datVersion: version,
            description: game.description || game.name,
            category: category,
            roms
          };
          dats.push(dat);
          onEntry?.(dat);
        }

        processed++;
        if (processed % 50 === 0) {
          console.log(`[mame] Processed ${processed}/${xmlFiles.length} hash files...`);
        }
      } catch (err) {
        console.warn(`[mame] Failed to fetch ${filename}: ${(err as Error).message}`);
      }
    }

    console.log(`[mame] Hash DATs: ${dats.length} entries from ${processed} files`);
    return dats;
  }

  /**
   * List all XML files in the hash/ directory via GitHub API
   */
  private async listHashFiles(): Promise<string[]> {
    const url = `https://api.github.com/repos/${MAME_REPO.owner}/${MAME_REPO.repo}/contents/hash`;
    const headers: Record<string, string> = {
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'metadat-mame-pipeline'
    };
    if (this.apiToken) {
      headers['Authorization'] = `token ${this.apiToken}`;
    }

    const response = await this.fetchWithRetry(url, { headers });
    const data = await response.json();

    if (!Array.isArray(data)) {
      throw new Error(`Unexpected GitHub API response: ${JSON.stringify(data).slice(0, 200)}`);
    }

    return data
      .filter((item: { name: string; type: string }) => item.type === 'file' && item.name.endsWith('.xml'))
      .map((item: { name: string }) => item.name)
      .sort();
  }

  /**
   * Fetch with retry logic built-in
   */
  private async fetchWithRetry(url: string, options: RequestInit = {}): Promise<Response> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        // Simple rate limiting between requests
        if (this.rateLimitMs > 0 && attempt > 1) {
          await new Promise(r => setTimeout(r, this.rateLimitMs));
        }
        const response = await fetch(url, options);

        if (response.status === 403 && response.headers.get('x-ratelimit-remaining') === '0') {
          const resetTime = parseInt(response.headers.get('x-ratelimit-reset') || '0') * 1000;
          const waitMs = Math.max(resetTime - Date.now(), 60000);
          console.warn(`[mame] GitHub rate limit hit, waiting ${Math.round(waitMs / 1000)}s...`);
          await new Promise(r => setTimeout(r, waitMs));
          continue;
        }

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        return response;
      } catch (err) {
        lastError = err as Error;
        if (attempt < this.maxRetries) {
          const delay = this.retryDelay * Math.pow(2, attempt - 1);
          await new Promise(r => setTimeout(r, delay));
        }
      }
    }

    throw lastError;
  }

  // Rate limiting is handled by base class AbstractFetcher
}

/**
 * Categorize a hash/ XML file as computer or console
 * Uses keyword-based heuristics on the filename
 */
function categorizeHashFile(filename: string): MameSystemCategory {
  const name = filename.toLowerCase().replace('.xml', '');

  // Console keywords
  const consolePatterns = [
    /^a26/, /^a52/, /^a78/, // Atari consoles
    /^nes$/, /^snes/, /^n64/, /^gamecube/, /^wii/, /^switch/, // Nintendo
    /^sms$/, /^sms_/, /^megadriv/, /^genesis/, /^saturn/, /^dc$/, /^dc_/, // Sega
    /^psx/, /^ps2/, /^ps3/, /^psp/, // Sony
    /^xbox/, /^xbox360/, // Microsoft
    /^3do/, /^jaguar/, /^lynx/, /^atarijag/, // Atari other
    /^coleco/, /^intv/, /^odyssey/, // Classic
    /^ngp/, /^ngpc/, /^neogeo/, // SNK
    /^pce/, /^tg16/, /^pcfx/, /^pcecd/, // NEC
    /^gb$/, /^gb_/, /^gbc/, /^gba/, /^ds$/, /^ds_/, /^3ds/, // Nintendo handheld
    /^32x/, /^scd/, /^segacd/, // Sega addons
    /^vectrex/, /^virtualboy/, /^wonderswan/
  ];

  for (const pattern of consolePatterns) {
    if (pattern.test(name)) return MameSystemCategory.CONSOLES;
  }

  // Default to computers for everything else
  return MameSystemCategory.COMPUTERS;
}

/**
 * Extract ROM entries from a game entry (MAME format)
 */
function extractRomsFromGame(game: Record<string, unknown>): RomEntry[] {
  const roms: RomEntry[] = [];

  // Handle arcade rom elements
  let romElement = game.rom;

  // Handle software list rom/part elements (nested structure)
  if (!romElement && game.part) {
    const part = game.part as Record<string, unknown>;
    if (part.dataarea) {
      const dataarea = part.dataarea as Record<string, unknown>;
      romElement = dataarea.rom;
    }
  }

  if (!romElement) return roms;

  const romArray = Array.isArray(romElement) ? romElement : [romElement];

  for (const rom of romArray) {
    if (!rom || typeof rom !== 'object') continue;

    const romObj = rom as Record<string, unknown>;
    const entry: RomEntry = {
      name: String(romObj.name || romObj['@_name'] || ''),
      size: Number(romObj.size) || 0
    };

    if (romObj.crc) entry.crc = String(romObj.crc);
    if (romObj.md5) entry.md5 = String(romObj.md5);
    if (romObj.sha1) entry.sha1 = String(romObj.sha1);
    if (romObj.sha256) entry.sha256 = String(romObj.sha256);

    if (entry.name) roms.push(entry);
  }

  return roms;
}

// CLI entry point
const isDirectRun = process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'));
if (isDirectRun) {
  const outputDir = process.argv[2] || './output/mame';
  const tracker = new VersionTracker('./versions.json');
  const fetcher = new MameFetcher(tracker, outputDir);

  fetcher
    .fetch()
    .then(_dats => console.log(`[mame] Fetch complete`))
    .catch((err: Error) => {
      console.log(`[mame] ERROR: ${err.message}`);
      process.exit(1);
    });
}
