/**
 * DiscordNotifier - Sends pipeline notifications to Discord webhooks
 * 
 * Per S8 notification standard:
 * - Fancy embeds with colors (🟡 started, 🟢 success, 🔴 failure, ⚪ skipped)
 * - Stats tables
 * - Links to GitHub Action run and Release
 * 
 * @intent Send webhook notifications for pipeline events
 * @guarantee Handles started/success/failure/skipped with formatted embeds
 */

import type { PipelineEvent } from '../types/index.js';

/** S8 Discord embed colors (per spec) */
export const EMBED_COLORS = {
  started: 16776960,   // 🟡 Yellow
  success: 3066993,    // 🟢 Green  
  failure: 15158332,    // 🔴 Red
  skipped: 9807270,    // ⚪ Gray
  warning: 16744448     // 🟠 Orange
} as const;

// S8 event emoji mapping
// Note: Used in formatTitle(), formatDescription()

/**
 * Format duration in seconds to human readable
 */
export function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
}

/**
 * Get embed color for event type
 */
export function getEmbedColor(type: PipelineEvent['type']): number {
  return EMBED_COLORS[type] || EMBED_COLORS.started;
}

/**
 * DiscordNotifier class
 */
export class DiscordNotifier {
  private webhookUrl: string;
  private maxRetries: number;

  constructor(webhookUrl: string, maxRetries: number = 3) {
    this.webhookUrl = webhookUrl;
    this.maxRetries = maxRetries;
  }

  /**
   * Send notification for a pipeline event
   */
  async notify(event: PipelineEvent): Promise<void> {
    const embed = this.formatEmbed(event);
    const payload = {
      username: 'METADAT Pipeline',
      avatar_url: 'https://raw.githubusercontent.com/Mesh-ARKade/mesh-arkade/main/assets/icon.png',
      embeds: [embed]
    };

    await this.sendWithRetry(JSON.stringify(payload));
  }

  /**
   * Format Discord embed for event
   * Per S8 spec: stats tables, links, descriptions
   */
  private formatEmbed(event: PipelineEvent): Record<string, unknown> {
    const color = getEmbedColor(event.type);
    const title = this.formatTitle(event.type, event.source);
    const description = this.formatDescription(event);
    
    const fields: Array<{ name: string; value: string; inline?: boolean }> = [];

    // Add description if present
    if (description) {
      fields.push({ name: 'Description', value: description, inline: false });
    }

    // Add version
    if (event.version) {
      fields.push({ name: '📦 Version', value: event.version, inline: true });
    }

    // Add skip reason (per S8 spec)
    if (event.type === 'skipped' && event.skipReason) {
      fields.push({ name: '📋 Reason', value: event.skipReason, inline: false });
    }

    // Add stats table for success notifications (per S8 spec)
    if (event.type === 'success' && event.stats && event.stats.length > 0) {
      const statsTable = this.formatStatsTable(event.stats);
      fields.push({ name: '📊 Stats', value: statsTable, inline: false });
    }

    // Add stats for started notifications
    if (event.type === 'started' && event.version) {
      fields.push({ name: '⏱️ Started', value: new Date(event.timestamp).toUTCString(), inline: true });
    }

    // Add entry count
    if (event.entryCount) {
      fields.push({ name: '📝 Entries', value: event.entryCount.toLocaleString(), inline: true });
    }

    // Add artifact count
    if (event.artifactCount) {
      fields.push({ name: '📦 Artifacts', value: event.artifactCount.toString(), inline: true });
    }

    // Add duration
    if (event.duration) {
      const durationStr = event.type === 'failure' 
        ? `${formatDuration(event.duration)} (until failure)`
        : formatDuration(event.duration);
      fields.push({ name: '⏱️ Duration', value: durationStr, inline: true });
    }

    // Add error message for failure
    if (event.type === 'failure' && event.error) {
      fields.push({ name: '❗ Error', value: event.error, inline: false });
    }

    // Add links per S8 spec
    const links: string[] = [];
    if (event.actionUrl) {
      links.push(`[Action](${event.actionUrl})`);
    }
    if (event.releaseUrl) {
      links.push(`[Release](${event.releaseUrl})`);
    }
    if (links.length > 0) {
      fields.push({ name: '🔗 Links', value: links.join(' · '), inline: false });
    }

    const timestamp = new Date(event.timestamp).toISOString();

    // Determine URL for embed (use actionUrl or releaseUrl)
    const url = event.releaseUrl || event.actionUrl || undefined;

    return {
      title,
      description: description || undefined,
      color,
      url,
      fields,
      timestamp,
      footer: {
        text: `meshARKade-${event.source}`
      }
    };
  }

  /**
   * Format description text based on event type
   */
  private formatDescription(event: PipelineEvent): string {
    switch (event.type) {
      case 'started':
        return 'Fetching latest DATs...';
      case 'success':
        return 'Successfully fetched and validated DATs';
      case 'failure':
        return event.description || 'Pipeline failed during execution';
      case 'skipped':
        return event.description || 'Already on latest version';
      default:
        return '';
    }
  }

  /**
   * Format stats as markdown table per S8 spec
   */
  private formatStatsTable(stats: Array<{ metric: string; value: string }>): string {
    const rows = stats.map(s => `| ${s.metric} | ${s.value} |`).join('\n');
    return `\n${rows}\n`;
  }

  /**
   * Format title based on event type per S8 spec
   */
  private formatTitle(type: PipelineEvent['type'], source: string): string {
    const sourceLabel = source.charAt(0).toUpperCase() + source.slice(1).replace('-', ' ');
    
    switch (type) {
      case 'started':
        return `⏳ ${sourceLabel} Fetch Started`;
      case 'success':
        return `✅ ${sourceLabel} Fetch Complete`;
      case 'failure':
        return `❌ ${sourceLabel} Fetch Failed`;
      case 'skipped':
        return `⏭️ ${sourceLabel} Fetch Skipped`;
      default:
        return `📦 ${sourceLabel} Pipeline Update`;
    }
  }

  /**
   * Send webhook with retry logic
   */
  private async sendWithRetry(payload: string, attempt: number = 1): Promise<void> {
    try {
      const response = await fetch(this.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: payload
      });

      if (!response.ok && attempt < this.maxRetries) {
        // Wait before retry (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        return this.sendWithRetry(payload, attempt + 1);
      }

      if (!response.ok) {
        throw new Error(`Discord webhook failed: ${response.status}`);
      }
    } catch (err) {
      if (attempt < this.maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        return this.sendWithRetry(payload, attempt + 1);
      }
      throw err;
    }
  }
}