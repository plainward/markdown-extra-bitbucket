# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.1] — 2026-05-10

### Added

- **Bitbucket Data Center 10.x support** via secondary `-bb10.jar` artifact with `javax.*` rewritten to `jakarta.*` (Apache Tomcat `jakartaee-migration` 1.0.8). Single source tree, both JARs produced by `mvn package`.
- Cross-version Docker test infrastructure: `docker-compose.8x.yml`, `docker-compose.9x.yml` (Bitbucket 8.19.28 and 9.6.3) plus matching UPM upload scripts.
- `docker/COMPAT-TESTING.md` documenting the verification matrix.

### Security

- `PlantUmlRestController.@POST /render` now requires authentication (`isAuthenticated()`) before invoking the PlantUML renderer. Closes an unauthenticated DoS vector.

### Compatibility

- Default JAR: Bitbucket Data Center 8.0 – 9.99
- `-bb10` JAR: Bitbucket Data Center 10.0 and above

[1.0.1]: https://github.com/plainward/markdown-extra-bitbucket/releases/tag/v1.0.1

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
