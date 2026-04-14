/**
 * MAME Fetcher - GitHub Primary + ProgettoSnaps Fallback
 *
 * @intent Fetch MAME DATs from mamedev/mame GitHub repo (computers/consoles) and ProgettoSnaps (arcade)
 * @guarantee Returns all MAME DATs categorized into 3 groups: arcade, computers, consoles
 * @constraint No Playwright - uses direct HTTP and GitHub API only
 */

import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { execSync } from 'child_process';
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
 * ProgettoSnaps main page URL
 * Used to find the latest pack number
 */
const PROGETTO_SNAPS_URL = 'https://www.progettosnaps.net/dats/MAME/';

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
   * Finds latest pack, downloads 7z, extracts MAME.dat
   */
  private async fetchArcadeDats(version: string): Promise<DAT[]> {
    // Find latest pack number from ProgettoSnaps page
    const packNumber = await this.findLatestPackNumber();
    console.log(`[mame] Latest ProgettoSnaps pack: ${packNumber}`);

    // Download the 7z pack
    const packUrl = `https://www.progettosnaps.net/download/?tipo=dat_mame&file=/dats/MAME/packs/MAME_Dats_${packNumber}.7z`;
    const packPath = path.join(this.outputDir, `MAME_Dats_${packNumber}.7z`);

    console.log(`[mame] Downloading pack: ${packUrl}`);
    await this.downloadFile(packUrl, packPath);

    // Extract the 7z file
    const extractDir = path.join(this.outputDir, 'arcade-tmp');
    await fs.mkdir(extractDir, { recursive: true });
    await this.extract7z(packPath, extractDir);

    // Find and parse the MAME.dat file (search recursively)
    const mameDatPath = await this.findMameDat(extractDir);
    if (!mameDatPath) {
      console.warn('[mame] MAME.dat not found in extracted pack');
      return [];
    }
    console.log(`[mame] Found MAME.dat at: ${mameDatPath}`);

    const content = await fs.readFile(mameDatPath, 'utf-8');
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

    // Cleanup temp files
    await fs.unlink(packPath).catch(() => {});
    await fs.rm(extractDir, { recursive: true, force: true }).catch(() => {});

    console.log(`[mame] Arcade DAT: ${dats.length} entries`);
    return dats;
  }

  /**
   * Find the latest pack number from ProgettoSnaps page
   */
  private async findLatestPackNumber(): Promise<string> {
    const response = await this.fetchWithRetry(PROGETTO_SNAPS_URL);
    const html = await response.text();

    // Find all MAME_Dats_XXX.7z links and extract highest number
    const regex = /MAME_Dats_(\d+)\.7z/g;
    let maxPack = 0;
    let match;

    while ((match = regex.exec(html)) !== null) {
      const num = parseInt(match[1], 10);
      if (num > maxPack) maxPack = num;
    }

    if (maxPack === 0) {
      throw new Error('Could not find any MAME packs on ProgettoSnaps');
    }

    return maxPack.toString();
  }

  /**
   * Download a file using fetch (follows redirects)
   */
  private async downloadFile(url: string, destPath: string): Promise<void> {
    const response = await this.fetchWithRetry(url);
    const buffer = await response.arrayBuffer();
    await fs.writeFile(destPath, Buffer.from(buffer));
    console.log(`[mame] Downloaded: ${path.basename(destPath)}`);
  }

  /**
   * Recursively find MAME.dat in extraction directory
   */
  private async findMameDat(dir: string): Promise<string | null> {
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        const found = await this.findMameDat(fullPath);
        if (found) return found;
      } else if (entry.isFile() && entry.name.toLowerCase() === 'mame.dat') {
        return fullPath;
      }
    }

    return null;
  }

  /**
   * Extract 7z file using system 7z command
   */
  private async extract7z(archivePath: string, destDir: string, retries = 3): Promise<void> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        console.log(`[mame] Extracting ${path.basename(archivePath)} (attempt ${attempt}/${retries})...`);
        execSync(`7z x "${archivePath}" -o"${destDir}" -y`, { stdio: 'pipe' });
        console.log('[mame] Extraction complete');
        return;
      } catch (err) {
        lastError = err as Error;
        console.warn(`[mame] Extraction attempt ${attempt} failed: ${lastError.message}`);
        if (attempt < retries) {
          await new Promise(r => setTimeout(r, 2000));
        }
      }
    }

    throw new Error(`Failed to extract archive after ${retries} attempts: ${lastError?.message}`);
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
