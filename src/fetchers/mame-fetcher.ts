/**
 * MAME Fetcher - ProgettoSnaps implementation
 *
 * @intent Fetch DATs from ProgettoSnaps (MAME arcade, software lists, HBMAME)
 * @guarantee Downloads all MAME DAT categories from progettosnaps.net
 * @constraint Extends AbstractFetcher, uses direct HTTP for downloads
 *              Error screenshots captured on any failure for debugging
 */

import { chromium, type Page } from 'playwright';
import path from 'path';
import fs from 'fs/promises';
import crypto from 'crypto';
import { AbstractFetcher, type FetcherOptions } from '../base/base-fetcher.js';
import { VersionTracker } from '../core/version-tracker.js';
import type { DAT, RomEntry } from '../types/index.js';
import { extractGameEntries } from '../core/validator.js';
import { execSync } from 'child_process';

/**
 * ProgettoSnaps main DAT page URL
 */
const PROGETTO_SNAPS_URL = 'https://www.progettosnaps.net/dats/MAME/';

/**
 * MAME data source types from ProgettoSnaps
 */
export enum MameSourceType {
  ARCADE = 'arcade'
}

export class MameFetcher extends AbstractFetcher {
  private outputDir: string;

  constructor(
    versionTracker: VersionTracker,
    outputDir: string = './output/mame',
    options: FetcherOptions = {}
  ) {
    super(versionTracker, {
      maxRetries: options.maxRetries ?? 3,
      retryDelay: options.retryDelay ?? 5000,
      rateLimitMs: options.rateLimitMs ?? 2000
    });
    this.outputDir = outputDir;
  }

  getSourceName(): string {
    return 'mame';
  }

  /**
   * Check remote version by finding the latest pack number
   */
  async checkRemoteVersion(): Promise<string> {
    try {
      // Use Playwright to get the page and find the highest pack number
      const browser = await chromium.launch({ headless: true });
      const page = await browser.newPage();
      await page.goto(PROGETTO_SNAPS_URL, { waitUntil: 'load', timeout: 60000 });

      // Get all pack links and find the highest number
      const links = await page.locator('a[href*="MAME_Dats_"]').all();
      let maxPack = 0;

      for (const link of links) {
        const href = await link.getAttribute('href');
        const match = href?.match(/MAME_Dats_(\d+)\.7z/);
        if (match) {
          const num = parseInt(match[1], 10);
          if (num > maxPack) maxPack = num;
        }
      }

      await browser.close();

      if (maxPack > 0) {
        return maxPack.toString(); // e.g., "286"
      }

      return new Date().toISOString().split('T')[0];
    } catch (err) {
      console.warn('[mame] Failed to check remote version:', (err as Error).message);
      return new Date().toISOString().split('T')[0];
    }
  }

  /**
   * Fetch DATs from ProgettoSnaps
   * @param onEntry Optional callback for streaming entries (for pipeline compatibility)
   */
  async fetchDats(onEntry?: (dat: DAT) => void): Promise<DAT[]> {
    await fs.mkdir(this.outputDir, { recursive: true });

    console.log('[mame] Checking for latest MAME pack...');

    // Find the latest pack number
    const latestPack = await this.findLatestPackNumber();
    console.log(`[mame] Latest pack: ${latestPack}`);

    if (!latestPack) {
      throw new Error('Could not find any MAME packs on ProgettoSnaps');
    }

    // Download the latest pack
    const packUrl = `https://www.progettosnaps.net/download/?tipo=dat_mame&file=/dats/MAME/packs/MAME_Dats_${latestPack}.7z`;
    console.log(`[mame] Downloading: ${packUrl}`);

    const zipPath = path.join(this.outputDir, `MAME_Dats_${latestPack}.7z`);
    await this.downloadFile(packUrl, zipPath);

    // Extract the 7z file
    console.log('[mame] Extracting...');
    await this.extract7z(zipPath, this.outputDir);

    // Find and parse all DAT/XML files
    console.log('[mame] Parsing DAT files...');
    const dats = await this.parseAllDatFiles(this.outputDir, onEntry);

    console.log(`[mame] Total: ${dats.length} entries`);

    // Update version tracking
    const version = latestPack;
    await this.updateVersion(version);

    return dats;
  }

  /**
   * Find the latest pack number by scraping the page
   */
  private async findLatestPackNumber(): Promise<string | null> {
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage();
      await page.goto(PROGETTO_SNAPS_URL, { waitUntil: 'load', timeout: 60000 });

      // Get all MAME_Dats links and find the highest number
      const links = await page.locator('a[href*="MAME_Dats_"]').all();
      let maxPack = 0;

      for (const link of links) {
        const href = await link.getAttribute('href');
        const match = href?.match(/MAME_Dats_(\d+)\.7z/);
        if (match) {
          const num = parseInt(match[1], 10);
          if (num > maxPack) maxPack = num;
        }
      }

      return maxPack > 0 ? maxPack.toString().padStart(3, '0') : null;
    } finally {
      await browser.close();
    }
  }

  /**
   * Download a file using fetch (follows redirects)
   */
  private async downloadFile(url: string, destPath: string): Promise<void> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Download failed: ${response.status} ${response.statusText}`);
    }

    const buffer = await response.arrayBuffer();
    await fs.writeFile(destPath, Buffer.from(buffer));
    console.log(`[mame] Downloaded: ${path.basename(destPath)}`);
  }

  /**
   * Extract 7z file - tries 7z, then fallback to other methods
   */
  private async extract7z(archivePath: string, destDir: string): Promise<void> {
    try {
      // Try 7z command first
      execSync(`7z x "${archivePath}" -o"${destDir}" -y`, { stdio: 'inherit' });
    } catch {
      try {
        // Try p7zip on WSL or other tools
        execSync(`7za x "${archivePath}" -o"${destDir}" -y`, { stdio: 'inherit' });
      } catch {
        // Try Windows PowerShell Expand
        try {
          execSync(`powershell -Command "Expand-Archive -Path '${archivePath}' -DestinationPath '${destDir}' -Force"`, { stdio: 'inherit' });
        } catch (err) {
          throw new Error(`Failed to extract archive: ${(err as Error).message}`);
        }
      }
    }
  }

  /**
   * Recursively find and parse all DAT/XML files
   */
  private async parseAllDatFiles(
    dirPath: string,
    onEntry?: (dat: DAT) => void
  ): Promise<DAT[]> {
    const dats: DAT[] = [];

    async function scanDir(dir: string): Promise<void> {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          await scanDir(fullPath);
        } else if (entry.isFile() && /\.(dat|xml)$/i.test(entry.name)) {
          console.log(`[mame] Parsing: ${entry.name}`);

          try {
            const content = await fs.readFile(fullPath, 'utf-8');
            const result = extractGameEntries(content);

            if (result.valid && result.games.length > 0) {
              const systemName = path.basename(entry.name, path.extname(entry.name));

              for (const game of result.games) {
                const roms = extractRomsFromGame(game);
                const dat: DAT = {
                  id: `${systemName}:${game.name || game.description || 'unknown'}`,
                  source: 'mame',
                  system: systemName,
                  datVersion: new Date().toISOString(),
                  description: game.name || game.description,
                  roms
                };

                if (onEntry) {
                  onEntry(dat);
                } else {
                  dats.push(dat);
                }
              }
            }
          } catch (parseErr) {
            console.warn(`[mame] Failed to parse ${entry.name}:`, (parseErr as Error).message);
          }
        }
      }
    }

    await scanDir(dirPath);
    return dats;
  }

  /**
   * Capture a screenshot on error for debugging
   */
  private async captureErrorScreenshot(page: Page): Promise<void> {
    try {
      const screenshotPath = path.join(this.outputDir, 'metadat-mame--error-playwright.png');
      await page.screenshot({ path: screenshotPath });
      console.log(`[mame] Error screenshot saved: ${screenshotPath}`);
    } catch (screenshotErr) {
      console.warn(`[mame] Failed to capture error screenshot: ${(screenshotErr as Error).message}`);
    }
  }
}

/**
 * Extract ROM entries from a game entry (MAME format)
 */
function extractRomsFromGame(game: Record<string, unknown>): RomEntry[] {
  const roms: RomEntry[] = [];

  const romElement = game.rom;
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