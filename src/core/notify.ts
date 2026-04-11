/**
 * Send Discord notification from workflow
 * Usage: node dist/core/notify.js <event> <source>
 * 
 * Environment variables:
 *   DISCORD_WEBHOOK_URL
 *   GITHUB_REPOSITORY
 *   GITHUB_RUN_ID
 *   GITHUB_SERVER_URL
 */

import { DiscordNotifier } from './notifier.js';
import type { PipelineEvent } from '../types/index.js';

// Parse args
const eventType = process.argv[2] || 'success';
const source = process.argv[3] || 'unknown';

if (!process.env.DISCORD_WEBHOOK_URL) {
  console.error('DISCORD_WEBHOOK_URL not set');
  process.exit(1);
}

const githubRepo = process.env.GITHUB_REPOSITORY || 'unknown/repo';
const runId = process.env.GITHUB_RUN_ID || '';
const serverUrl = process.env.GITHUB_SERVER_URL || 'https://github.com';

const actionUrl = `${serverUrl}/${githubRepo}/actions/runs/${runId}`;

// Build event data
const event: PipelineEvent = {
  type: eventType as PipelineEvent['type'],
  source,
  timestamp: new Date().toISOString(),
  actionUrl,
  
  // These would be populated from actual pipeline results
  version: process.env.PIPELINE_VERSION || '',
  entryCount: parseInt(process.env.PIPELINE_ENTRIES || '0', 10) || undefined,
  artifactCount: parseInt(process.env.PIPELINE_ARTIFACTS || '0', 10) || undefined,
  duration: parseInt(process.env.PIPELINE_DURATION || '0', 10) || undefined,
  
  // For success - stats
  stats: process.env.PIPELINE_STATS 
    ? JSON.parse(process.env.PIPELINE_STATS)
    : undefined,
    
  // For failure
  error: process.env.PIPELINE_ERROR || undefined,
  
  // For skipped
  skipReason: process.env.PIPELINE_SKIP_REASON || undefined,
  
  // Release URL (for success)
  releaseUrl: process.env.PIPELINE_RELEASE_URL || undefined,
};

const notifier = new DiscordNotifier(process.env.DISCORD_WEBHOOK_URL);

console.log(`[notify] Sending ${eventType} notification for ${source}...`);

try {
  await notifier.notify(event);
  console.log('[notify] Notification sent successfully');
} catch (err) {
  console.error('[notify] Failed to send notification:', (err as Error).message);
  process.exit(1);
}