/**
 * Pipeline Phase Runner
 * 
 * @intent Run individual pipeline phases for GitHub Actions visibility
 * @guarantee Each phase can run independently with proper state management
 * @constraint STREAMS data to disk to maintain low memory footprint (Old Repo Strategy)
 */

import { parseArgs } from 'util';
import path from 'path';
import fs from 'fs/promises';
import fsSync from 'fs';
import readline from 'readline';

import { VersionTracker } from '../core/version-tracker.js';
import { compress, trainDictionary, compressWithDictionary, compressWithImmutableDict, hasImmutableDictionary } from '../core/compressor.js';
import { GitHubReleaser } from '../core/releaser.js';
import { validatePipelineState, type DAT, type Artifact } from '../types/index.js';

// MAME-specific imports
import { MameFetcher } from '../fetchers/mame-fetcher.js';
import { MameGroupStrategy } from '../strategies/mame-grouping.js';

type Phase = 'fetch' | 'group' | 'dict' | 'jsonl' | 'compress' | 'release';

interface PhaseOptions {
  source: string;
  phase: Phase;
  outputDir: string;
}

const STATE_FILE = '.pipeline-state.json';

interface PipelineState {
  phase?: 'fetch' | 'group' | 'compress';
  source: string;
  // Paths to stream data instead of arrays
  fetchPath?: string;
  groupDir?: string;
  artifacts?: Artifact[];
  dictPath?: string;
  lastArtifacts?: Record<string, string>;
}

/**
 * Convert a string into a URL/filename-safe slug.
 */
function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

async function loadState(): Promise<PipelineState | null> {
  try {
    const data = await fs.readFile(STATE_FILE, 'utf-8');
    const parsed = JSON.parse(data);
    // Simple validation
    if (!parsed.source) return null;
    return parsed;
  } catch {
    return null;
  }
}

async function saveState(state: PipelineState, phase?: 'fetch' | 'group' | 'compress'): Promise<void> {
  if (phase) state.phase = phase;
  await fs.writeFile(STATE_FILE, JSON.stringify(state, null, 2));
}

async function runPhase(options: PhaseOptions): Promise<void> {
  const outputDir = options.outputDir;
  await fs.mkdir(outputDir, { recursive: true });
  
  const state = await loadState() || { source: options.source };
  
  switch (options.phase) {
    case 'fetch': {
      console.log('[phase:fetch] Fetching MAME DATs (Streaming to Disk)...');
      const versionTracker = new VersionTracker('./versions.json');
      const fetcher = new MameFetcher(versionTracker, outputDir);

      const shouldSkip = await fetcher.shouldSkip();
      if (shouldSkip) {
        const storedVersion = fetcher.getStoredVersion();
        const msg = `[phase:fetch] No new DATs available (version ${storedVersion} unchanged), skipping pipeline...`;
        console.log(msg);
        if (process.env.GITHUB_ENV) {
          await fs.appendFile(process.env.GITHUB_ENV, `SKIP_PIPELINE=true\nSKIP_REASON=${encodeURIComponent(msg)}\n`);
        }
        process.exit(0);
      }
      
      const fetchPath = path.join(outputDir, 'raw-fetch.jsonl');
      // Clear existing
      if (fsSync.existsSync(fetchPath)) await fs.unlink(fetchPath);
      
      const writeStream = fsSync.createWriteStream(fetchPath);
      
      let count = 0;
      await fetcher.fetchDats((dat) => {
        writeStream.write(JSON.stringify(dat) + '\n');
        count++;
        if (count % 10000 === 0) console.log(`[phase:fetch] Processed ${count} entries...`);
      });
      
      await new Promise((resolve) => writeStream.end(resolve));
      
      // Check if we got any entries
      if (count === 0) {
        throw new Error('No DATs fetched - source may be unavailable or parse failed');
      }
      
      console.log(`[phase:fetch] Completed. Streamed ${count} entries to ${fetchPath}`);
      
      state.fetchPath = fetchPath;
      await saveState(state, 'fetch');
      break;
    }
    
    case 'group': {
      console.log('[phase:group] Grouping entries (Stream-based)...');
      if (!state.fetchPath || !fsSync.existsSync(state.fetchPath)) {
        throw new Error('No fetch data found - run fetch phase first');
      }
      
      const groupDir = path.join(outputDir, '.tmp-groups');
      if (fsSync.existsSync(groupDir)) await fs.rm(groupDir, { recursive: true });
      await fs.mkdir(groupDir, { recursive: true });

      const groupStrategy = new MameGroupStrategy();
      const fileStream = fsSync.createReadStream(state.fetchPath);
      const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

      const groupStreams = new Map<string, fsSync.WriteStream>();
      let count = 0;

      for await (const line of rl) {
        if (!line.trim()) continue;
        const dat = JSON.parse(line) as DAT;
        const groupName = groupStrategy.getGroup(dat);
        
        if (!groupStreams.has(groupName)) {
          const groupPath = path.join(groupDir, `${slugify(groupName)}.jsonl`);
          groupStreams.set(groupName, fsSync.createWriteStream(groupPath));
        }
        
        groupStreams.get(groupName)!.write(line + '\n');
        count++;
        if (count % 50000 === 0) console.log(`[phase:group] Grouped ${count} entries...`);
      }

      for (const stream of groupStreams.values()) {
        await new Promise((resolve) => stream.end(resolve));
      }

      console.log(`[phase:group] Grouping complete. ${count} entries processed.`);
      state.groupDir = groupDir;
      await saveState(state, 'group');
      break;
    }
    
    case 'jsonl': {
      // JSONL files are already created during group phase
      // This phase exists for workflow compatibility and future expansion
      console.log('[phase:jsonl] JSONL files already generated in group phase, skipping...');
      break;
    }
    
    case 'dict': {
      console.log('[phase:dict] Checking for immutable dictionary...');
      if (hasImmutableDictionary()) {
        console.log('[phase:dict] Immutable dictionary found, skipping training');
        break;
      }

      console.log('[phase:dict] Training dictionary (from sampled stream)...');
      if (!state.fetchPath) throw new Error('No fetch data - run fetch phase first');
      
      // Sample 1000 entries from the stream
      const samples: string[] = [];
      const fileStream = fsSync.createReadStream(state.fetchPath);
      const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });
      
      let count = 0;
      for await (const line of rl) {
        if (count < 1000) {
          samples.push(line);
          count++;
        } else {
          break;
        }
      }
      fileStream.destroy();

      const dictPath = path.join(outputDir, `${options.source}.dict`);
      await trainDictionary(samples, dictPath);
      
      const IMMUTABLE_DICT_PATH = 'src/data/catalog.dict';
      await fs.mkdir(path.dirname(IMMUTABLE_DICT_PATH), { recursive: true });
      await fs.copyFile(dictPath, IMMUTABLE_DICT_PATH);
      
      state.dictPath = dictPath;
      await saveState(state);
      break;
    }
    
    case 'compress': {
      console.log('[phase:compress] Compressing grouped files...');
      if (!state.groupDir || !fsSync.existsSync(state.groupDir)) {
        throw new Error('No group data found - run group phase first');
      }
      
      const versionTracker = new VersionTracker('./versions.json');
      const lastArtifacts = await versionTracker.getArtifactHashes(options.source);
      if (lastArtifacts) state.lastArtifacts = lastArtifacts;
      
      const artifacts: Artifact[] = [];
      const groupFiles = await fs.readdir(state.groupDir);
      const useImmutable = hasImmutableDictionary();

      for (const file of groupFiles) {
        if (!file.endsWith('.jsonl')) continue;
        
        const groupName = file.replace('.jsonl', '');
        const inputPath = path.join(state.groupDir, file);
        const zstFileName = `${options.source}--${groupName}.jsonl.zst`;
        const zstPath = path.join(outputDir, zstFileName);
        
        console.log(`[phase:compress] Processing ${groupName}...`);
        
        // Count entries in this group
        let entryCount = 0;
        const rl = readline.createInterface({ input: fsSync.createReadStream(inputPath), crlfDelay: Infinity });
        const systemCounts = new Map<string, number>();
        
        for await (const line of rl) {
          if (!line.trim()) continue;
          entryCount++;
          const dat = JSON.parse(line) as DAT;
          systemCounts.set(dat.system, (systemCounts.get(dat.system) || 0) + 1);
        }

        let artifact;
        const content = await fs.readFile(inputPath, 'utf-8');
        if (useImmutable) {
          artifact = await compressWithImmutableDict(content, zstPath);
        } else if (state.dictPath) {
          artifact = await compressWithDictionary(content, zstPath, state.dictPath);
        } else {
          artifact = await compress(content, zstPath);
        }
        
        let op: 'upsert' | 'unchanged' = 'upsert';
        if (state.lastArtifacts?.[artifact.name] === artifact.sha256) op = 'unchanged';
        
        artifacts.push({
          ...artifact,
          entryCount,
          op,
          systems: Array.from(systemCounts.entries()).map(([name, gameCount]) => ({ id: name, name, gameCount }))
        });
      }
      
      // Create manifest
      const manifest = {
        version: '1.0.0',
        generated: new Date().toISOString(),
        sources: [{
          name: options.source as any,
          repo: `Mesh-ARKade/metadat-${options.source}`,
          release: `${options.source}-${new Date().toISOString().split('T')[0]}`,
          date: new Date().toISOString().split('T')[0],
          artifacts: artifacts.map(a => ({
            name: a.name,
            url: `https://github.com/Mesh-ARKade/metadat-${options.source}/releases/latest/download/${a.name}`,
            size: a.size,
            sha256: a.sha256,
            systems: a.systems || []
          }))
        }]
      };
      
      await fs.writeFile(path.join(outputDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
      state.artifacts = artifacts;
      await saveState(state, 'compress');
      break;
    }
    
    case 'release': {
      console.log('[phase:release] Starting release...');
      if (!state.artifacts) throw new Error('No artifacts found');
      
      const versionTracker = new VersionTracker('./versions.json');
      const releaser = new GitHubReleaser(
        process.env.GITHUB_OWNER || 'Mesh-ARKade',
        process.env.GITHUB_REPO || `metadat-${options.source}`,
        process.env.GITHUB_TOKEN || ''
      );
      
      const manifestPath = path.join(outputDir, 'manifest.json');
      const manifestContent = await fs.readFile(manifestPath, 'utf-8');
      const manifestArtifact: Artifact = {
        name: 'manifest.json', path: manifestPath, size: manifestContent.length,
        sha256: '', entryCount: 0, op: 'upsert', systems: []
      };
      
      const artifactsToUpload = state.artifacts.filter(a => a.op === 'upsert');
      const releaseArtifacts: Artifact[] = [...artifactsToUpload, manifestArtifact];
      const tag = `${options.source}-${new Date().toISOString().split('T')[0]}`;
      
      const release = await releaser.createReleaseIncremental(tag, releaseArtifacts, [...state.artifacts, manifestArtifact]);
      
      if (process.env.GITHUB_ENV) {
        const totalEntries = state.artifacts.reduce((sum, a) => sum + a.entryCount, 0);
        const stats = [
          { metric: 'Total Games', value: totalEntries.toLocaleString() },
          { metric: 'Artifacts', value: `${artifactsToUpload.length} new / ${state.artifacts.length - artifactsToUpload.length} skip` }
        ];
        await fs.appendFile(process.env.GITHUB_ENV, `PIPELINE_RELEASE_URL=${release.htmlUrl}\nPIPELINE_STATS=${JSON.stringify(stats)}\n`);
      }
      
      const artifactHashes: Record<string, string> = {};
      for (const a of state.artifacts) if (a.sha256) artifactHashes[a.name] = a.sha256;
      await versionTracker.saveArtifactHashes(options.source, artifactHashes);
      
      // Cleanup
      await fs.unlink(STATE_FILE).catch(() => {});
      if (state.fetchPath) await fs.unlink(state.fetchPath).catch(() => {});
      if (state.groupDir) await fs.rm(state.groupDir, { recursive: true }).catch(() => {});
      break;
    }
  }
  console.log(`[phase:${options.phase}] Complete`);
}

const { values } = parseArgs({
  options: {
    source: { type: 'string', short: 's', default: 'mame' },
    phase: { type: 'string' },
    'output-dir': { type: 'string', short: 'o', default: './output' },
    help: { type: 'boolean', short: 'h', default: false }
  }
});

if (values.help || !values.phase) {
  process.exit(0);
}

runPhase({
  source: values.source || 'mame',
  phase: values.phase as Phase,
  outputDir: values['output-dir'] || './output'
}).catch(err => {
  console.error(`[phase] Error: ${(err as Error).message}`);
  process.exit(1);
});
