/**
 * Core exports
 *
 * @intent Re-export all core implementations
 * @guarantee Single import point for all core modules
 */

export { VersionTracker } from './version-tracker.js';
export { XmlValidator, validateWellFormed, validateFile, checkExtension, extractGameEntries } from './validator.js';
export { ZstdCompressor, compress, decompress, compressWithDictionary, trainDictionary } from './compressor.js';
export { GitHubReleaser, generateReleaseNotes } from './releaser.js';
export { DiscordNotifier, formatDuration, getEmbedColor, EMBED_COLORS } from './notifier.js';