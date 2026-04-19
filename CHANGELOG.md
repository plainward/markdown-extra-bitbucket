# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] — 2026-04-19

Initial open source release under Apache License 2.0.

### Features

- Mermaid diagram rendering (client-side, 20+ diagram types, 4 themes) inside file view, file browser, pull request descriptions and diffs, commits, and compare views.
- PlantUML diagram rendering (server-side to SVG).
- LaTeX math rendering via KaTeX — block (` ```math `) and inline (`$…$`, `$$…$$`).
- Plugin admin SPA reachable from Bitbucket **Administration → Add-ons → MarkdownX Admin**, with per-feature toggles (Mermaid / PlantUML / LaTeX math) and Mermaid theme selector.
- Bundled docker compose environments for Bitbucket Data Center 8.19 and 10.x with UPM auto-upload helper scripts.

### Compatibility

- Bitbucket Data Center 8.19+ (tested). Targets 9.x and 10.x.
- Java 11+ at runtime (provided by Bitbucket).

[1.0.0]: https://github.com/plainward/markdown-extra-bitbucket/releases/tag/v1.0.0
