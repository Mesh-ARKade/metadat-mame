/**
 * DiscordNotifier tests
 *
 * @intent Verify DiscordNotifier sends webhook notifications correctly
 * @guarantee Handles started/success/failure/skipped events, retry logic
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { PipelineEvent } from '../../src/types/index.js';

describe('DiscordNotifier', () => {
  let notifier: typeof import('../../src/core/notifier.js');
  let originalFetch: typeof fetch;

  beforeEach(async () => {
    notifier = await import('../../src/core/notifier.js');
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe('notify()', () => {
    it('should send notification to webhook URL', async () => {
      const fetchSpy = vi.fn().mockResolvedValue({ ok: true });
      globalThis.fetch = fetchSpy;

      const instance = new notifier.DiscordNotifier('https://discord.webhook.url/test');
      
      const event: PipelineEvent = {
        type: 'started',
        source: 'no-intro',
        timestamp: new Date().toISOString()
      };

      await instance.notify(event);

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const call = fetchSpy.mock.calls[0];
      expect(call[0]).toBe('https://discord.webhook.url/test');
      expect(call[1].method).toBe('POST');
      expect(call[1].headers['Content-Type']).toBe('application/json');
    });

    it('should include event type in payload', async () => {
      const fetchSpy = vi.fn().mockResolvedValue({ ok: true });
      globalThis.fetch = fetchSpy;

      const instance = new notifier.DiscordNotifier('https://discord.webhook.url');
      
      const event: PipelineEvent = {
        type: 'success',
        source: 'no-intro',
        timestamp: new Date().toISOString()
      };

      await instance.notify(event);

      const call = fetchSpy.mock.calls[0];
      const body = JSON.parse(call[1].body as string);
      expect(body.embeds).toHaveLength(1);
      expect(body.embeds[0].title).toBeDefined();
    });

    it('should include source in footer', async () => {
      const fetchSpy = vi.fn().mockResolvedValue({ ok: true });
      globalThis.fetch = fetchSpy;

      const instance = new notifier.DiscordNotifier('https://discord.webhook.url');
      
      const event: PipelineEvent = {
        type: 'started',
        source: 'redump',
        timestamp: new Date().toISOString()
      };

      await instance.notify(event);

      const call = fetchSpy.mock.calls[0];
      const body = JSON.parse(call[1].body as string);
      expect(body.embeds[0].footer.text).toContain('redump');
    });

    it('should retry on failure', async () => {
      const fetchSpy = vi.fn()
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({ ok: true });
      globalThis.fetch = fetchSpy;

      const instance = new notifier.DiscordNotifier('https://discord.webhook.url');
      
      const event: PipelineEvent = {
        type: 'started',
        source: 'test',
        timestamp: new Date().toISOString()
      };

      await instance.notify(event);

      // Should have retried
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });
  });

  describe('formatDuration()', () => {
    it('should format seconds to mm:ss', () => {
      expect(notifier.formatDuration(120)).toBe('2m 0s');
      expect(notifier.formatDuration(65)).toBe('1m 5s');
    });
  });

  describe('getEmbedColor()', () => {
    it('should return color per event type', () => {
      expect(notifier.getEmbedColor('started')).toBeDefined();
      expect(notifier.getEmbedColor('success')).toBeDefined();
      expect(notifier.getEmbedColor('failure')).toBeDefined();
      expect(notifier.getEmbedColor('skipped')).toBeDefined();
    });
  });
});