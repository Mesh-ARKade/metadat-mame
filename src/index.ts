/**
 * metadat-template
 *
 * Shared foundation for metadat repositories — validation, compression, release, notifications.
 * Clone this template to create source-specific metadat repositories.
 *
 * Structure:
 * - src/contracts/   - Interface definitions (IFetcher, IValidator, etc.)
 * - src/types/       - Core type definitions
 * - src/core/        - Shared implementations
 * - src/base/        - Abstract base classes
 */

export type { DAT, GroupedDATs, Artifact, PipelineEvent, ValidationResult, Release } from './types/index.js';
export type { IFetcher } from './contracts/ifetcher.js';
export type { IValidator } from './contracts/ivalidator.js';
export type { ICompressor } from './contracts/icompressor.js';
export type { IGroupStrategy } from './contracts/igroup-strategy.js';
export type { IReleaser } from './contracts/ireleaser.js';
export type { INotifier } from './contracts/inotifier.js';

// Re-export Zod schemas for pipeline state validation
export {
  RomEntrySchema,
  DATSchema,
  ArtifactSchema,
  FetchPhaseStateSchema,
  GroupPhaseStateSchema,
  CompressPhaseStateSchema,
  PipelineStateSchema,
  validatePipelineState
} from './types/index.js';