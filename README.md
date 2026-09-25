# MarkdownX — Markdown Extra for Bitbucket

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)
[![Bitbucket Data Center](https://img.shields.io/badge/Bitbucket-Data%20Center%208.19%2B-0052cc.svg)](https://www.atlassian.com/software/bitbucket)

Enhanced Markdown rendering for Bitbucket Data Center: **Mermaid** diagrams, **PlantUML** diagrams, and **LaTeX math** (KaTeX) — right inside the file browser, pull request diffs, commits, and READMEs.

## Features

- **Mermaid diagrams** — 20+ diagram types (flowcharts, sequence, class, state, ER, Gantt, pie, git-graph, mindmap, timeline, C4, Sankey, XY, etc.). Rendered client-side, loaded lazily.
- **PlantUML diagrams** — 15+ UML and non-UML diagram types. Rendered server-side to SVG.
- **LaTeX math** — block (` ```math `) and inline (`$…$`, `$$…$$`) formulas via KaTeX.
- **Mermaid themes** — default / dark / forest / neutral, selectable in plugin admin.

All features run everywhere rendered Markdown appears: file view, file browser, pull request descriptions and diffs, commits, and compare views.

## Requirements

- Bitbucket Data Center **8.19+** (tested on 8.19, targets 9.x and 10.x — see Compatibility below)
- Java 11+ (runtime, provided by Bitbucket)

## Installation

1. Download the latest `markdown-extra-*.jar` from [Releases](https://github.com/plainward/markdown-extra-bitbucket/releases).
2. In Bitbucket: **Administration → Manage apps → Upload app**.
3. Upload the JAR. That's it — all features are active.

## Usage

Just write regular Markdown:

````markdown
```mermaid
sequenceDiagram
    Alice->>Bob: Hi
    Bob-->>Alice: Hi!
```

```plantuml
@startuml
Alice -> Bob : Authentication Request
Bob --> Alice : Authentication Response
@enduml
```

```math
E = mc^2
```

Inline math: $a^2 + b^2 = c^2$.
````

Diagrams render automatically when the file is viewed in Bitbucket.

## Build

```bash
cd frontend && npm install && npm run build && cd ..

export JAVA_HOME=/path/to/jdk21
mvn package -DskipTests
```

`mvn package` also runs the unit tests (drop `-DskipTests`). The resulting JARs are written to `target/markdown-extra-<version>.jar` (Bitbucket 8.x/9.x) and `target/markdown-extra-<version>-bb10.jar` (Bitbucket 10.x).

## Local deploy

After building, upload the JAR to a running Bitbucket via the UPM REST API:

```bash
./deploy.sh [BITBUCKET_URL] [USERNAME] [PASSWORD]
# defaults: http://localhost:7990  admin  admin
```

Or start a clean Bitbucket 8.19 in Docker:

```bash
cd docker
docker compose up -d
./deploy-plugin.sh admin admin    # deploys target/*.jar to localhost:7990
```

For Bitbucket 10.x use `docker-compose.10x.yml` and `deploy-plugin-10x.sh` (runs on `localhost:7991`).

## Architecture

| Layer | Files |
|-------|-------|
| Plugin descriptor | `src/main/resources/atlassian-plugin.xml` |
| Spring scan config | `src/main/resources/META-INF/spring/plugin-context.xml` |
| REST (settings, PlantUML) | `src/main/java/com/plainward/bitbucket/markdownx/rest/` |
| Services (settings, PlantUML render) | `src/main/java/com/plainward/bitbucket/markdownx/service/` |
| Admin page (servlet, SYS_ADMIN only) | `src/main/java/com/plainward/bitbucket/markdownx/servlet/`, `src/main/resources/templates/admin.html` |
| Frontend orchestrator | `frontend/src/markdown-enhancer.js` |
| Mermaid (iframe + Shadow DOM) | `frontend/src/mermaid-enhancer.js` |
| PlantUML (REST → SVG) | `frontend/src/plantuml-enhancer.js` |
| LaTeX (KaTeX) | `frontend/src/katex-enhancer.js` |
| MutationObserver | `frontend/src/utils/dom-observer.js` |

Two non-obvious choices are worth calling out:

- **Mermaid renders inside a hidden `<iframe>`, then mounts into a Shadow DOM.** Bitbucket loads different CSS bundles per page context (`filebrowser` vs `fileContent`), and the page CSS corrupts Mermaid's `getBBox()` text measurements if it renders in an offscreen container on the host page. An iframe gives it a clean document.
- **Rendering is locked down against stored XSS.** Anyone who can push Markdown controls the diagram source, so Mermaid runs with `securityLevel: 'strict'`, KaTeX with `trust: false`, and PlantUML SVG is passed through DOMPurify before insertion. PlantUML runs server-side in its `SANDBOX` security profile (no file or URL includes), with a render timeout and a bounded worker pool.
- **Built JS is named `*-min.js` to bypass the AMPS YUI Compressor.** The compressor is ES3-only and silently destroys the ES6+ output from Vite; AMPS skips any filename with the `-min` suffix.

## Development

### Bundled docker compose

```bash
cd docker
docker compose up -d       # Bitbucket 8.19 on http://localhost:7990
# or
docker compose -f docker-compose.10x.yml up -d   # Bitbucket 10.x on :7991
```

Default credentials after first-run setup: `admin` / `admin` (configure during Bitbucket onboarding). Edit `docker/.env` to pick a different Bitbucket patch version.

### Debug logging in the browser

```js
localStorage.setItem('markdownx-debug', '1');  // enable, then reload
localStorage.removeItem('markdownx-debug');    // disable
```

### Test URLs (local Bitbucket on 8.x)

- File browser: `http://localhost:7990/projects/TEST/repos/test-markdown/browse?at=main`
- File view: `http://localhost:7990/projects/TEST/repos/test-markdown/browse/README.md?at=main`
- Admin: Bitbucket **Administration → Add-ons → MarkdownX Admin** (or open `http://localhost:7990/plugins/servlet/markdownx/admin` directly, or click **Configure** in Manage apps)

## Compatibility

| Bitbucket DC | Status |
|--------------|--------|
| 8.x (8.19+)  | Tested — default JAR |
| 9.x          | Tested on 9.6 — default JAR |
| 10.x         | Tested on 10.2 — `-bb10` JAR |

See [docker/COMPAT-TESTING.md](docker/COMPAT-TESTING.md) for the verification matrix.

## Contributing

Contributions welcome — see [CONTRIBUTING.md](CONTRIBUTING.md).

## Security

Please report vulnerabilities privately — see [SECURITY.md](SECURITY.md).

## License

Apache License 2.0. See [LICENSE](LICENSE).

Bundled third-party libraries: PlantUML (`plantuml-asl`, Apache-2.0), Mermaid (MIT), KaTeX (MIT), DOMPurify (Apache-2.0 / MPL-2.0).
