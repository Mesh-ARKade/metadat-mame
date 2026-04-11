/**
 * Pipeline Phase Runner
 * 
 * @intent Run individual pipeline phases for GitHub Actions visibility
 * @guarantee Each phase can run independently with proper state management
 */

import { parseArgs } from 'util';
import path from 'path';
import fs from 'fs/promises';
import { VersionTracker } from '../core/version-tracker.js';
import { compress, trainDictionary, compressWithDictionary } from '../core/compressor.js';
import { GitHubReleaser } from '../core/releaser.js';
import type { DAT, GroupedDATs, Artifact } from '../types/index.js';

// TODO: Import your source-specific fetcher and strategy
// import { MyFetcher } from '../fetchers/my-fetcher.js';
// import { MyGroupStrategy } from '../strategies/my-grouping.js';

type Phase = 'fetch' | 'group' | 'dict' | 'jsonl' | 'compress' | 'release';

interface PhaseOptions {
  source: string;
  phase: Phase;
  outputDir: string;
}

const STATE_FILE = '.pipeline-state.json';

interface PipelineState {
  source: string;
  dats?: DAT[];
  groupedDats?: GroupedDATs;
  artifacts?: Artifact[];
  dictPath?: string;
  // Last release artifact SHA256s for incremental detection
  lastArtifacts?: Record<string, string>;
}

/**
 * Convert a string into a URL/filename-safe slug.
 */
function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')  // Non-alphanumeric -> hyphens
    .replace(/^-|-$/g, '');       // Trim leading/trailing hyphens
}

async function loadState(): Promise<PipelineState | null> {
  try {
    const data = await fs.readFile(STATE_FILE, 'utf-8');
    return JSON.parse(data);
  } catch {
    return null;
  }
}


async function saveState(state: PipelineState): Promise<void> {
  await fs.writeFile(STATE_FILE, JSON.stringify(state, null, 2));
}

async function runPhase(options: PhaseOptions): Promise<void> {
  const outputDir = options.outputDir;
  await fs.mkdir(outputDir, { recursive: true });
  
  const state = await loadState() || { source: options.source };
  
  switch (options.phase) {
    case 'fetch': {
      console.log('[phase:fetch] Fetching DATs...');
      const versionTracker = new VersionTracker('./versions.json');
      
      // TODO: Instantiate your fetcher here
      // const fetcher = new MyFetcher(versionTracker, outputDir);
      const fetcher: any = null; // Remove this line when implementing
      
      if (!fetcher) {
        console.warn('Note: versionTracker initialized:', versionTracker !== null);
        throw new Error('Fetcher not implemented in template. Please implement your source fetcher.');
      }

      const shouldSkip = await fetcher.shouldSkip();
      if (shouldSkip) {
        console.log('[phase:fetch] Already on latest version, skipping...');
        if (process.env.GITHUB_ENV) {
          await fs.appendFile(process.env.GITHUB_ENV, 'SKIP_PIPELINE=true\n');
        }
        process.exit(0);
      }
      
      const dats = await fetcher.fetch();
      console.log(`[phase:fetch] Fetched ${dats.length} games`);
      
      if (dats.length === 0) {
        throw new Error('No DATs fetched');
      }
      
      state.dats = dats;
      await saveState(state);
      break;
    }
    
    case 'group': {
      console.log('[phase:group] Grouping DATs...');
      if (!state.dats) {
        throw new Error('No DATs loaded - run fetch phase first');
      }
      
      // TODO: Instantiate your grouping strategy here
      // const groupStrategy = new MyGroupStrategy();
      const groupStrategy: any = null; // Remove this line when implementing
      
      if (!groupStrategy) {
        throw new Error('Group strategy not implemented in template. Please implement your grouping strategy.');
      }

      const groupedDats = groupStrategy.group(state.dats);
      const groupNames = Object.keys(groupedDats);
      
      console.log(`[phase:group] Created ${groupNames.length} groups: ${groupNames.join(', ')}`);
      
      state.groupedDats = groupedDats;
      await saveState(state);
      break;
    }
    
    case 'dict': {
      console.log('[phase:dict] Training dictionary...');
      if (!state.dats) {
        throw new Error('No DATs loaded - run fetch phase first');
      }
      
      const dictDir = path.join(outputDir, '.dict');
      await fs.mkdir(dictDir, { recursive: true });
      
      const dictPath = path.join(dictDir, `${options.source}.dict`);
      const sample = JSON.stringify(state.dats.slice(0, 10));
      
      await trainDictionary([sample], dictPath);
      console.log(`[phase:dict] Dictionary trained: ${dictPath}`);
      
      state.dictPath = dictPath;
      await saveState(state);
      break;
    }
    
    case 'jsonl': {
      console.log('[phase:jsonl] Creating JSONL files...');
      if (!state.groupedDats) {
        throw new Error('No grouped DATs - run group phase first');
      }
      
      const groupNames = Object.keys(state.groupedDats);
      
      for (const groupName of groupNames) {
        const groupDats = state.groupedDats[groupName];
        if (!groupDats || groupDats.length === 0) continue;
        
        const jsonlContent = groupDats.map((d: DAT) => JSON.stringify(d)).join('\n');
        const jsonlFileName = `${options.source}--${slugify(groupName)}.jsonl`;
        const jsonlPath = path.join(outputDir, jsonlFileName);
        
        await fs.writeFile(jsonlPath, jsonlContent);
        console.log(`[phase:jsonl] Created: ${jsonlFileName} (${groupDats.length} entries)`);
      }
      break;
    }
    
    case 'compress': {
      console.log('[phase:compress] Compressing to ZST...');
      if (!state.groupedDats) {
        throw new Error('No grouped DATs - run group phase first');
      }
      
      // Load last release artifact hashes from versions.json for comparison
      const versionTracker = new VersionTracker('./versions.json');
      const lastArtifacts = await versionTracker.getArtifactHashes(options.source);
      if (lastArtifacts && Object.keys(lastArtifacts).length > 0) {
        state.lastArtifacts = lastArtifacts;
        console.log('[phase:compress] Loaded last release artifacts for comparison');
      }
      
      const artifacts: Artifact[] = [];
      const groupNames = Object.keys(state.groupedDats);
      
      // Check for dictionary
      let dictPath = '';
      if (state.dictPath) {
        try {
          await fs.readFile(state.dictPath);
          dictPath = state.dictPath;
          console.log('[phase:compress] Using dictionary');
        } catch {
          console.log('[phase:compress] Dictionary not found, using standard compression');
        }
      }
      
      for (const groupName of groupNames) {
        const groupDats = state.groupedDats[groupName];
        if (!groupDats || groupDats.length === 0) continue;
        
        const jsonlContent = groupDats.map((d: DAT) => JSON.stringify(d)).join('\n');
        const zstFileName = `${options.source}--${slugify(groupName)}.jsonl.zst`;
        const zstPath = path.join(outputDir, zstFileName);
        
        let artifact;
        if (dictPath) {
          try {
            artifact = await compressWithDictionary(jsonlContent, zstPath, dictPath);
          } catch {
            artifact = await compress(jsonlContent, zstPath);
          }
        } else {
          artifact = await compress(jsonlContent, zstPath);
        }
        
        // Track op for incremental release
        let op: 'upsert' | 'unchanged' = 'upsert';
        const lastSha = state.lastArtifacts?.[artifact.name];
        if (lastSha && lastSha === artifact.sha256) {
          op = 'unchanged';
          console.log(`[phase:compress] Unchanged: ${zstFileName}`);
        }
        
        const newArtifact: Artifact = {
          name: artifact.name,
          path: artifact.path,
          size: artifact.size,
          sha256: artifact.sha256,
          entryCount: artifact.entryCount,
          op,
          // Aggregate systems: count unique games in this group
          systems: Object.entries(
            groupDats.reduce((acc: Record<string, number>, d) => {
              acc[d.system] = (acc[d.system] || 0) + 1;
              return acc;
            }, {})
          ).map(([name, gameCount]) => ({ id: name, name, gameCount }))
        };
        
        artifacts.push(newArtifact);
        
        console.log(`[phase:compress] Created: ${zstFileName} (${artifact.size} bytes)`);
      }
      
      // Create manifest
      const manifest = {
        version: '1.0.0',
        generated: new Date().toISOString(),
        sources: [{
          name: options.source as 'no-intro' | 'tosec' | 'redump' | 'mame',
          repo: `Mesh-ARKade/metadat-${options.source}`,
          release: `${options.source}-${new Date().toISOString().split('T')[0]}`,
          date: new Date().toISOString().split('T')[0],
          artifacts: artifacts.map(a => ({
            name: a.name,
            url: `https://github.com/Mesh-ARKade/metadat-${options.source}/releases/latest/${a.name}`,
            size: a.size,
            sha256: a.sha256,
            systems: a.systems || []
          }))
        }]
      };
      
      const manifestPath = path.join(outputDir, 'manifest.json');
      await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));
      console.log('[phase:compress] Created: manifest.json');
      
      // Clean up state - don't save large DATs
      state.artifacts = artifacts;
      state.dats = undefined;
      state.groupedDats = undefined;
      await saveState(state);
      break;
    }
    
    case 'release': {
      console.log('[phase:release] Creating GitHub release...');
      if (!state.artifacts || state.artifacts.length === 0) {
        throw new Error('No artifacts - run compress phase first');
      }
      
      // Create version tracker for saving hashes
      const versionTracker = new VersionTracker('./versions.json');
      
      const releaser = new GitHubReleaser(
        process.env.GITHUB_OWNER || 'Mesh-ARKade',
        process.env.GITHUB_REPO || (options.source === 'no-intro' ? 'metadat-nointro' : `metadat-${options.source}`),
        process.env.GITHUB_TOKEN || ''
      );
      
      // Include manifest in release
      const manifestPath = path.join(outputDir, 'manifest.json');
      const manifestContent = await fs.readFile(manifestPath, 'utf-8');
      const manifestArtifact: Artifact = {
        name: 'manifest.json',
        path: manifestPath,
        size: manifestContent.length,
        sha256: '',
        entryCount: 0,
        op: 'upsert',
        systems: []
      };
      
      // Only upload changed artifacts (op: upsert) + manifest
      const artifactsToUpload = state.artifacts.filter(a => a.op === 'upsert');
      const unchangedCount = state.artifacts.filter(a => a.op === 'unchanged').length;
      console.log(`[phase:release] ${artifactsToUpload.length} changed, ${unchangedCount} unchanged`);
      
      const releaseArtifacts: Artifact[] = [...artifactsToUpload, manifestArtifact];
      const allReleaseArtifacts: Artifact[] = [...state.artifacts, manifestArtifact];
      const tag = `${options.source}-${new Date().toISOString().split('T')[0]}`;
      const release = await releaser.createReleaseIncremental(tag, releaseArtifacts, allReleaseArtifacts);
      
      // Export variables for GitHub Actions
      if (process.env.GITHUB_ENV) {
        const totalEntries = state.artifacts.reduce((sum, a) => sum + a.entryCount, 0);
        const totalSize = state.artifacts.reduce((sum, a) => sum + a.size, 0);
        const uploadSize = artifactsToUpload.reduce((sum, a) => sum + a.size, 0);
        const savedSize = state.artifacts.filter(a => a.op === 'unchanged').reduce((sum, a) => sum + a.size, 0);
        
        const formatSize = (bytes: number) => (bytes / (1024 * 1024)).toFixed(2) + ' MB';
        const systemsCount = new Set(state.artifacts.flatMap(a => a.systems?.map(s => s.id) || [])).size;
        
        const stats = [
          { metric: 'Total Games', value: totalEntries.toLocaleString() },
          { metric: 'Systems', value: systemsCount.toString() },
          { metric: 'Artifacts', value: `${artifactsToUpload.length} new / ${unchangedCount} skip` },
          { metric: 'Upload Vol', value: formatSize(uploadSize) },
          { metric: 'Saved BW', value: formatSize(savedSize) },
          { metric: 'Total Size', value: formatSize(totalSize) }
        ];
        
        const envContent = [
          `PIPELINE_RELEASE_URL=${release.htmlUrl}`,
          `PIPELINE_ENTRIES=${totalEntries}`,
          `PIPELINE_ARTIFACTS=${state.artifacts.length}`,
          `PIPELINE_STATS=${JSON.stringify(stats)}`
        ].join('\n') + '\n';
        
        await fs.appendFile(process.env.GITHUB_ENV, envContent);
      }
      
      // Save artifact hashes for next incremental release
      const artifactHashes: Record<string, string> = {};
      for (const a of state.artifacts) {
        if (a.sha256) {
          artifactHashes[a.name] = a.sha256;
        }
      }
      await versionTracker.saveArtifactHashes(options.source, artifactHashes);
      console.log('[phase:release] Saved artifact hashes for incremental tracking');
      
      // Clean up state file
      await fs.unlink(STATE_FILE).catch(() => {});
      break;
    }
  }
  
  console.log(`[phase:${options.phase}] Complete`);
}

// CLI
const { values } = parseArgs({
  options: {
    source: { type: 'string', short: 's', default: 'test' },
    phase: { type: 'string' },
    'output-dir': { type: 'string', short: 'o', default: './output' },
    help: { type: 'boolean', short: 'h', default: false }
  }
});

if (values.help || !values.phase) {
  console.log(`
Pipeline Phase Runner
Usage: node dist/scripts/pipeline-phase.js [options]

Options:
  --phase <phase>    Phase to run: fetch, group, dict, jsonl, compress, release
  -s, --source       Source name (default: test)
  -o, --output-dir   Output directory (default: ./output)
  -h, --help

Phases:
  fetch     - Download DATs from source
  group     - Group DATs by manufacturer
  dict      - Train compression dictionary
  jsonl     - Create JSONL files
  compress  - Compress to ZST
  release   - Create GitHub release
`);
  process.exit(0);
}

runPhase({
  source: values.source || 'test',
  phase: values.phase as Phase,
  outputDir: values['output-dir'] || './output'
}).catch(err => {
  console.error(`[phase] Error: ${(err as Error).message}`);
  process.exit(1);
});
