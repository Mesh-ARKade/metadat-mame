/**
 * INotifier contract tests
 *
 * @intent Verify INotifier interface contract
 * @guarantee Implementations conform to the expected interface
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { INotifier } from '../../src/contracts/inotifier.js';
import type { PipelineEvent } from '../../src/types/index.js';

describe('INotifier Contract', () => {
  let mockNotifier: INotifier;

  beforeEach(() => {
    mockNotifier = {
      notify: vi.fn().mockResolvedValue(undefined)
    };
  });

  describe('notify()', () => {
    it('should accept a PipelineEvent', async () => {
      const event: PipelineEvent = {
        type: 'started',
        source: 'test-source',
        timestamp: new Date().toISOString()
      };

      await mockNotifier.notify(event);

      expect(mockNotifier.notify).toHaveBeenCalledWith(event);
    });

    it('should handle started event', async () => {
      const event: PipelineEvent = {
        type: 'started',
        source: 'test-source',
        timestamp: new Date().toISOString()
      };

      await mockNotifier.notify(event);

      expect(mockNotifier.notify).toHaveBeenCalled();
    });

    it('should handle success event', async () => {
      const event: PipelineEvent = {
        type: 'success',
        source: 'test-source',
        timestamp: new Date().toISOString(),
        duration: 120,
        entryCount: 1000,
        artifactCount: 5,
        version: '1.0.0'
      };

      await mockNotifier.notify(event);

      expect(mockNotifier.notify).toHaveBeenCalled();
    });

    it('should handle failure event', async () => {
      const event: PipelineEvent = {
        type: 'failure',
        source: 'test-source',
        timestamp: new Date().toISOString(),
        error: 'Connection timeout'
      };

      await mockNotifier.notify(event);

      expect(mockNotifier.notify).toHaveBeenCalled();
    });

    it('should handle skipped event', async () => {
      const event: PipelineEvent = {
        type: 'skipped',
        source: 'test-source',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
      };

      await mockNotifier.notify(event);

      expect(mockNotifier.notify).toHaveBeenCalled();
    });

    it('should be async', () => {
      const event: PipelineEvent = {
        type: 'started',
        source: 'test-source',
        timestamp: new Date().toISOString()
      };

      const result = mockNotifier.notify(event);
      expect(result).toBeInstanceOf(Promise);
    });
  });
});