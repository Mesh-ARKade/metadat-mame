/**
 * Core type definitions for metadat-template
 *
 * @intent Define the foundational types used across all modules
 * @guarantee These types represent the domain model without implementation details
 * @constraint Do not add methods or logic - only data shapes
 */

export interface RomEntry {
  name: string;
  size: number;
  crc?: string;
  md5?: string;
  sha1?: string;
  sha256?: string;
}

export interface DAT {
  /** Unique identifier for this DAT */
  id: string;
  /** Source name (no-intro, tosec, redump, mame) */
  source: string;
  /** System/family name */
  system: string;
  /** DAT file version for change detection */
  datVersion: string;
  /** List of ROM entries in this DAT */
  roms: RomEntry[];
  /** Optional description/header info */
  description?: string;
  /** Optional category */
  category?: string;
  /** Optional path to source file */
  filePath?: string;
}

export interface GroupedDATs {
  /** Map of group name to array of DATs in that group */
  [groupName: string]: DAT[];
}

export interface Artifact {
  /** Unique artifact name (e.g., "no-intro--nintendo.jsonl.zst") */
  name: string;
  /** Absolute path to the compressed artifact file */
  path: string;
  /** Size in bytes */
  size: number;
  /** SHA-256 hash of the artifact */
  sha256: string;
  /** Number of games/entries in this artifact */
  entryCount: number;
  /** Operation type for incremental updates */
  op?: 'upsert' | 'unchanged';
  /** Optional URL if uploaded to a release */
  url?: string;
  /** Optional dictionary path used for compression */
  dictionary?: string;
  /** Systems included in this artifact (per manifest schema) */
  systems?: Array<{ id: string; name: string; gameCount: number }>;
}

export interface PipelineEvent {
  /** Event type */
  type: 'started' | 'success' | 'failure' | 'skipped';
  /** Source name */
  source: string;
  /** Timestamp */
  timestamp: string;
  /** Optional run duration in seconds */
  duration?: number;
  /** Optional entry count */
  entryCount?: number;
  /** Optional artifact count */
  artifactCount?: number;
  /** Optional error message */
  error?: string;
  /** Optional version info */
  version?: string;
  /** Optional description text */
  description?: string;
  /** Optional skip reason (used when type is 'skipped') */
  skipReason?: string;
  /** Optional link to GitHub Action run */
  actionUrl?: string;
  /** Optional link to release */
  releaseUrl?: string;
  /** Optional stats table markdown (for success notifications) */
  stats?: Array<{ metric: string; value: string }>;
}

export interface ValidationResult {
  /** Whether validation passed */
  valid: boolean;
  /** Number of DATs validated */
  datCount: number;
  /** Number of errors */
  errorCount: number;
  /** Array of error messages */
  errors: string[];
  /** Optional warnings */
  warnings?: string[];
}

export interface Release {
  /** Release tag name */
  tag: string;
  /** Release title */
  name: string;
  /** Release body/notes */
  body: string;
  /** Whether this is a draft */
  draft: boolean;
  /** Whether this is a prerelease */
  prerelease: boolean;
  /** Array of uploaded assets */
  assets: Asset[];
  /** Release HTML URL */
  htmlUrl: string;
  /** Creation timestamp */
  createdAt: string;
}

export interface Asset {
  /** Asset name */
  name: string;
  /** Asset size in bytes */
  size: number;
  /** Asset download count */
  downloadCount: number;
  /** Asset browser download URL */
  browserDownloadUrl: string;
}

export interface VersionInfo {
  /** Version string (format depends on source) */
  version: string;
  /** ISO timestamp of last check */
  lastChecked: string;
  /** Artifact SHA256 hashes for incremental releases */
  artifacts?: Record<string, string>;
}