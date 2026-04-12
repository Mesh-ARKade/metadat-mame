/**
 * MAME Fetcher - ProgettoSnaps Playwright implementation
 *
 * @intent Fetch DATs from ProgettoSnaps (MAME arcade, software lists, HBMAME)
 * @guarantee Downloads all MAME DAT categories from progettosnaps.net
 * @constraint Extends AbstractFetcher, uses Playwright for browser automation
 *              Error screenshots captured on any failure for debugging
 */

import { chromium, type Browser, type Page } from 'playwright';
import path from 'path';
import fs from 'fs/promises';
import crypto from 'crypto';
import unzipper from 'unzipper';
import { AbstractFetcher, type FetcherOptions } from '../base/base-fetcher.js';
import { VersionTracker } from '../core/version-tracker.js';
import type { DAT, RomEntry } from '../types/index.js';
import { extractGameEntries } from '../core/validator.js';

/**
 * ProgettoSnaps main DAT page URL
 */
const PROGETTO_SNAPS_URL = 'https://www.progettosnaps.net/dats/MAME/';

/**
 * MAME data source types from ProgettoSnaps
 */
export enum MameSourceType {
  ARCADE = 'arcade',
  SOFTWARE_LISTS = 'software-lists',
  HBMAME = 'hbmame'
}

/**
 * Source configuration for each MAME category
 */
interface SourceConfig {
  type: MameSourceType;
  name: string;
  enabled: boolean;
}

/**
 * MAME version info from ProgettoSnaps
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
      retryDelay: options.retryDelay ?? 5000,
      rateLimitMs: options.rateLimitMs ?? 2000
    });
    this.outputDir = outputDir;

    // ProgettoSnaps source categories
    this.sources = [
      {
        type: MameSourceType.ARCADE,
        name: 'MAME',
        enabled: true
      },
      {
        type: MameSourceType.SOFTWARE_LISTS,
        name: 'MAME Software Lists',
        enabled: true
      },
      {
        type: MameSourceType.HBMAME,
        name: 'HBMAME',
        enabled: true
      }
    ];
  }

  getSourceName(): string {
    return 'mame';
  }

  /**
   * Check remote version by fetching the ProgettoSnaps page
   */
  async checkRemoteVersion(): Promise<string> {
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage();
      await page.goto(PROGETTO_SNAPS_URL, { waitUntil: 'load', timeout: 60000 });

      // ProgettoSnaps typically shows the date/version on the page
      // Try to extract version info from the page
      const pageText = await page.textContent('body');

      // Look for version patterns (e.g., "2024-01-15" or "v2024-01")
      const dateMatch = pageText?.match(/(\d{4}-\d{2}-\d{2})/);
      if (dateMatch) {
        return dateMatch[1];
      }

      // Try to find version in download links
      const links = await page.locator('a[href*=".zip"]').all();
      for (const link of links) {
        const href = await link.getAttribute('href');
        const versionMatch = href?.match(/(\d{4}\d{2}\d{2}|\d{4}-\d{2})/);
        if (versionMatch) {
          return versionMatch[1];
        }
      }

      // Fallback: use today's date
      return new Date().toISOString().split('T')[0];
    } catch (err) {
      console.warn('[mame] Failed to check remote version:', (err as Error).message);
      return new Date().toISOString().split('T')[0];
    } finally {
      await browser.close();
    }
  }

  /**
   * Fetch DATs from ProgettoSnaps using Playwright
   * @param onEntry Optional callback for streaming entries (for pipeline compatibility)
   */
  async fetchDats(onEntry?: (dat: DAT) => void): Promise<DAT[]> {
    await fs.mkdir(this.outputDir, { recursive: true });

    console.log('[mame] Launching browser...');
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ acceptDownloads: true });
    const page = await context.newPage();

    // Capture console messages for debugging
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.log('[mame] Console error:', msg.text());
      }
    });

    try {
      // Navigate to ProgettoSnaps with retry
      let attempt = 0;
      const maxAttempts = 3;
      while (attempt < maxAttempts) {
        try {
          await page.goto(PROGETTO_SNAPS_URL, { waitUntil: 'load', timeout: 60000 });
          break;
        } catch (err) {
          attempt++;
          if (attempt === maxAttempts) {
            await this.captureErrorScreenshot(page);
            throw err;
          }
          console.warn(`[mame] Navigation attempt ${attempt} failed, retrying...`);
          await new Promise(r => setTimeout(r, 5000));
        }
      }

      console.log('[mame] Page loaded, searching for download links...');

      const allDats: DAT[] = [];

      // Process each source type
      for (const source of this.sources) {
        if (!source.enabled) continue;

        try {
          console.log(`[mame] Processing: ${source.name}...`);
          const dats = await this.processSource(page, source);
          
          // Use callback for streaming if provided
          if (onEntry) {
            for (const dat of dats) {
              onEntry(dat);
            }
          } else {
            allDats.push(...dats);
          }
          
          console.log(`[mame] ${source.name}: ${dats.length} games`);
        } catch (err) {
          console.error(`[mame] Failed to process ${source.name}:`, (err as Error).message);
          // Capture screenshot on failure
          await this.captureErrorScreenshot(page);
        }
      }

      console.log(`[mame] Total: ${onEntry ? 'streamed' : allDats.length} games from all sources`);

      // Update version tracking
      const version = await this.checkRemoteVersion();
      await this.updateVersion(version);

      return allDats;
    } catch (err) {
      // Capture screenshot on any error for debugging
      await this.captureErrorScreenshot(page);
      throw err;
    } finally {
      await browser.close();
    }
  }

  /**
   * Process a specific MAME source category
   * @param page Playwright page instance
   * @param source Source configuration
   * @returns Array of parsed DAT entries
   */
  private async processSource(page: Page, source: SourceConfig): Promise<DAT[]> {
    const dats: DAT[] = [];

    // Find the download link for this category
    // ProgettoSnaps typically has links like "Download MAME"
    const categoryLink = page.locator(`a:has-text("${source.name}")`).first();
    const linkCount = await categoryLink.count();

    if (linkCount === 0) {
      // Try alternative pattern - look for links containing the category name
      const altLink = page.locator(`a[href*=".zip"]:has-text("${source.name}")`).first();
      const altCount = await altLink.count();

      if (altCount === 0) {
        console.warn(`[mame] No download link found for ${source.name}`);
        return dats;
      }

      // Download the file
      const download = await this.downloadFromLink(page, altLink);
      if (download) {
        const parsed = await this.extractAndParse(download);
        dats.push(...parsed);
      }
    } else {
      // Click the category link to expand/download
      // Some ProgettoSnaps pages have expandable sections
      await categoryLink.click();
      await page.waitForTimeout(2000);

      // Look for download buttons after expansion
      const downloadBtn = page.locator('a:has-text("Download"), button:has-text("Download")').first();
      const btnCount = await downloadBtn.count();

      if (btnCount > 0) {
        const download = await this.downloadFromLink(page, downloadBtn);
        if (download) {
          const parsed = await this.extractAndParse(download);
          dats.push(...parsed);
        }
      }
    }

    return dats;
  }

  /**
   * Download file from a Playwright element
   * @param page Playwright page
   * @param element Link/button element to click
   * @returns Path to downloaded file
   */
  private async downloadFromLink(page: Page, element: any): Promise<string | null> {
    try {
      // Get the href to check if it's a direct download
      const href = await element.getAttribute('href');

      if (href && href.endsWith('.zip')) {
        // Direct download link
        const downloadPromise = page.waitForEvent('download', { timeout: 300000 });
        await element.click();
        const download = await downloadPromise;

        const filename = download.suggestedFilename();
        const finalPath = path.join(this.outputDir, filename);
        await download.saveAs(finalPath);

        console.log(`[mame] Downloaded: ${filename}`);
        return finalPath;
      } else {
        // Navigate to download page
        await element.click();
        await page.waitForTimeout(3000);

        // Look for actual download link on the next page
        const downloadLink = page.locator('a[href*=".zip"]').first();
        const downloadCount = await downloadLink.count();

        if (downloadCount > 0) {
          return await this.downloadFromLink(page, downloadLink);
        }
      }
    } catch (err) {
      console.error(`[mame] Download failed:`, (err as Error).message);
    }

    return null;
  }

  /**
   * Extract downloaded zip and parse DAT XML files
   * @param zipPath Path to downloaded zip file
   * @returns Array of parsed DAT entries
   */
  private async extractAndParse(zipPath: string): Promise<DAT[]> {
    const dats: DAT[] = [];

    try {
      console.log(`[mame] Extracting: ${path.basename(zipPath)}`);

      // Open and extract the zip
      const zip = await unzipper.Open.file(zipPath);

      for (const file of zip.files) {
        // Only process .dat and .xml files
        if (file.type === 'File' && /\.(dat|xml)$/i.test(file.path)) {
          console.log(`[mame] Parsing: ${path.basename(file.path)}`);

          const buffer = await file.buffer();
          const content = buffer.toString('utf8');
          const result = extractGameEntries(content);

          if (result.valid && result.games.length > 0) {
            // Extract system name from filename
            const filename = path.basename(file.path, path.extname(file.path));
            const systemName = filename.replace(/\.dat$/i, '');

            for (const game of result.games) {
              const roms = extractRomsFromGame(game);

              dats.push({
                id: `${systemName}:${game.name || game.description || 'unknown'}`,
                source: 'mame',
                system: systemName,
                datVersion: new Date().toISOString(),
                description: game.name || game.description,
                roms
              });
            }
          }
        }
      }
    } catch (err) {
      console.error(`[mame] Extract error: ${(err as Error).message}`);
    }

    return dats;
  }

  /**
   * Capture a screenshot on error for debugging
   * @param page Playwright page instance
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

  /**
   * Verify checksum of a downloaded file
   * @param filePath Path to the downloaded file
   * @param expectedChecksum Expected checksum value
   * @param algorithm Hash algorithm (md5, sha1, sha256)
   */
  async verifyChecksum(
    filePath: string,
    expectedChecksum: string,
    algorithm: 'md5' | 'sha1' | 'sha256' = 'md5'
  ): Promise<void> {
    const fileBuffer = await fs.readFile(filePath);
    const hash = crypto.createHash(algorithm).update(fileBuffer).digest('hex');

    if (hash !== expectedChecksum.toLowerCase()) {
      throw new Error(
        `Checksum verification failed: expected ${expectedChecksum}, got ${hash}`
      );
    }

    console.log(`[mame] Checksum verified: ${algorithm}=${hash}`);
  }
}

/**
 * Extract ROM entries from a game entry (MAME format)
 * @param game Game object from XML parser
 * @returns Array of ROM entries
 */
function extractRomsFromGame(game: Record<string, unknown>): RomEntry[] {
  const roms: RomEntry[] = [];

  // MAME format: game has 'rom' child elements
  const romElement = game.rom;
  if (!romElement) return roms;

  // Handle single ROM or array of ROMs
  const romArray = Array.isArray(romElement) ? romElement : [romElement];

  for (const rom of romArray) {
    if (!rom || typeof rom !== 'object') continue;

    const romObj = rom as Record<string, unknown>;
    const entry: RomEntry = {
      name: String(romObj.name || romObj['@_name'] || ''),
      size: Number(romObj.size) || 0
    };

    // Add checksums if present
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
      console.log(`[mame] SKIP: ${err.message}`);
      process.exit(0);
    });
}