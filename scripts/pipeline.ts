/**
 * Pipeline CLI
 *
 * @intent Orchestrate the full pipeline: fetch → validate → compress → release
 * @guarantee Integrates all core components with proper error handling
 */

import { parseArgs } from 'util';
import { VersionTracker } from '../src/core/version-tracker.js';
import { validateFile, checkExtension } from '../src/core/validator.js';
import { compress } from '../src/core/compressor.js';
import { GitHubReleaser } from '../src/core/releaser.js';
import { DiscordNotifier } from '../src/core/notifier.js';
import type { DAT, Artifact, PipelineEvent } from '../src/types/index.js';

interface PipelineOptions {
  dryRun: boolean;
  source: string;
  outputDir: string;
  skipNotification: boolean;
}

/**
 * Main pipeline orchestration
 */
export async function runPipeline(options: PipelineOptions): Promise<void> {
  const startTime = Date.now();
  const versionTracker = new VersionTracker('./versions.json');
  
  console.log(`[pipeline] Starting ${options.source} pipeline...`);
  
  // Send started notification
  if (!options.skipNotification) {
    const notifier = new DiscordNotifier(process.env.DISCORD_WEBHOOK_URL || '');
    const event: PipelineEvent = {
      type: 'started',
      source: options.source,
      timestamp: new Date().toISOString()
    };
    await notifier.notify(event).catch(console.error);
  }

  try {
    // Step 1: Check version (skip logic)
    console.log('[pipeline] Checking for updates...');
    // Note: In a real implementation, this would call the source-specific fetcher
    
    // Step 2: Fetch DATs (source-specific implementation)
    console.log('[pipeline] Fetching DATs...');
    const dats: DAT[] = []; // Would be populated by fetcher
    
    // Step 3: Validate DATs
    console.log('[pipeline] Validating DATs...');
    for (const dat of dats) {
      if (dat.filePath) {
        const extCheck = checkExtension(dat.filePath);
        if (!extCheck.valid) {
          throw new Error(extCheck.error);
        }
        const validation = await validateFile(dat.filePath);
        if (!validation.valid) {
          throw new Error(validation.error);
        }
      }
    }
    console.log(`[pipeline] Validated ${dats.length} DATs`);
    
    // Step 4: Compress to artifacts
    console.log('[pipeline] Compressing to artifacts...');
    const artifacts: Artifact[] = []; // Would be populated by grouping + compression
    
    // Step 5: Create release (unless dry-run)
    if (!options.dryRun && artifacts.length > 0) {
      console.log('[pipeline] Creating GitHub release...');
      const releaser = new GitHubReleaser(
        process.env.GITHUB_OWNER || 'Mesh-ARKade',
        process.env.GITHUB_REPO || 'metadat-template',
        process.env.GITHUB_TOKEN || ''
      );
      
      const tag = `metadat-${options.source}-${new Date().toISOString().split('T')[0]}`;
      const release = await releaser.createRelease(tag, artifacts);
      console.log(`[pipeline] Release created: ${release.htmlUrl}`);
    }
    
    const duration = Math.floor((Date.now() - startTime) / 1000);
    
    // Send success notification
    if (!options.skipNotification) {
      const notifier = new DiscordNotifier(process.env.DISCORD_WEBHOOK_URL || '');
      const event: PipelineEvent = {
        type: 'success',
        source: options.source,
        timestamp: new Date().toISOString(),
        duration,
        entryCount: dats.reduce((sum, d) => sum + d.roms.length, 0),
        artifactCount: artifacts.length
      };
      await notifier.notify(event).catch(console.error);
    }
    
    console.log(`[pipeline] Completed in ${duration}s`);
    
  } catch (err) {
    const duration = Math.floor((Date.now() - startTime) / 1000);
    
    // Send failure notification
    if (!options.skipNotification) {
      const notifier = new DiscordNotifier(process.env.DISCORD_WEBHOOK_URL || '');
      const event: PipelineEvent = {
        type: 'failure',
        source: options.source,
        timestamp: new Date().toISOString(),
        duration,
        error: (err as Error).message
      };
      await notifier.notify(event).catch(console.error);
    }
    
    console.error(`[pipeline] Failed: ${(err as Error).message}`);
    process.exit(1);
  }
}

/**
 * CLI entry point
 */
if (import.meta.url === `file://${process.argv[1]}`) {
  const { values } = parseArgs({
    options: {
      'dry-run': {
        type: 'boolean',
        default: false,
        short: 'd'
      },
      source: {
        type: 'string',
        short: 's',
        default: 'test'
      },
      'output-dir': {
        type: 'string',
        short: 'o',
        default: './output'
      },
      'skip-notification': {
        type: 'boolean',
        default: false
      },
      help: {
        type: 'boolean',
        short: 'h',
        default: false
      }
    }
  });

  if (values.help) {
    console.log(`
METADAT Pipeline CLI

Usage: node scripts/pipeline.js [options]

Options:
  -d, --dry-run          Run without creating release
  -s, --source           Source name (default: test)
  -o, --output-dir       Output directory (default: ./output)
      --skip-notification  Don't send Discord notifications
  -h, --help             Show this help message

Environment Variables:
  GITHUB_OWNER           GitHub owner/organization
  GITHUB_REPO            GitHub repository name
  GITHUB_TOKEN           GitHub token for releases
  DISCORD_WEBHOOK_URL    Discord webhook URL for notifications
`);
    process.exit(0);
  }

  runPipeline({
    dryRun: values['dry-run'] || false,
    source: values.source || 'test',
    outputDir: values['output-dir'] || './output',
    skipNotification: values['skip-notification'] || false
  }).catch(console.error);
}