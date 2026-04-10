/**
 * INotifier interface
 *
 * @intent Define the contract for sending pipeline notifications
 * @guarantee Implementations send notifications for pipeline events
 */

import type { PipelineEvent } from '../types/index.js';

export interface INotifier {
  /**
   * Send a notification for a pipeline event
   * @param event Pipeline event to notify about
   */
  notify(_event: PipelineEvent): Promise<void>;
}