# metadat-template

*Shared foundation for metadat repositories — the DRY backbone of the pipeline.*

---

## Overview

This template provides the shared core components for all metadat repositories:

- **Interfaces** — Contracts for fetchers, validators, compressors, group strategies, releasers, notifiers
- **Core** — Shared implementations (VersionTracker, XmlValidator, ZstdCompressor, GitHubReleaser, DiscordNotifier)
- **Base** — Abstract base classes (AbstractFetcher with retry, rate-limit, version checking)

## Structure

```
metadat-template/
├── src/
│   ├── contracts/     # Interface definitions
│   ├── types/        # Core type definitions
│   ├── core/         # Shared implementations
│   ├── base/         # Abstract base classes
│   └── index.ts      # Main exports
├── tests/            # Test suite (100% coverage on core/)
├── scripts/          # CLI entry points
├── .github/workflows/# Reusable pipeline workflow
└── examples/        # Example implementations
```

## Usage

1. Click "Use this template" on GitHub to create a new metadat repo
2. Clone locally
3. Implement your source-specific fetcher extending `AbstractFetcher`
4. Implement your grouping strategy implementing `IGroupStrategy`
5. Configure the workflow parameters

## For Developers

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Run tests
npm run test

# Run with coverage
npm run test:coverage

# Lint
npm run lint

# Format
npm run format
```

## Related

- [metadat-no-intro](https://github.com/Mesh-ARKade/metadat-no-intro)
- [metadat-tosec](https://github.com/Mesh-ARKade/metadat-tosec)
- [metadat-redump](https://github.com/Mesh-ARKade/metadat-redump)
- [metadat-mame](https://github.com/Mesh-ARKade/metadat-mame)
- [meshARKade](https://github.com/Mesh-ARKade/mesh-arkade) — Main client