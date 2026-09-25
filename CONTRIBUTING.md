# Contributing to MarkdownX

Thanks for your interest in improving MarkdownX. This is a small OSS project maintained in spare time, so expect friendly but occasionally slow review cycles.

By contributing to this repository you agree that your contributions are licensed under the [Apache License 2.0](LICENSE), the same license the project uses.

## Reporting bugs

Open a [GitHub issue](https://github.com/plainward/markdown-extra-bitbucket/issues) using the bug report template. Please include:

- Bitbucket Data Center version and edition
- MarkdownX plugin version
- Steps to reproduce
- Expected vs. actual behaviour
- Browser + Bitbucket server log excerpts (redact secrets before posting)

**Never** report security vulnerabilities in public issues — see [SECURITY.md](SECURITY.md).

## Suggesting features

Open a [GitHub issue](https://github.com/plainward/markdown-extra-bitbucket/issues) using the feature request template. Describe the problem first, then the solution you have in mind and any alternatives you considered.

## Pull requests

1. Fork the repo and create a topic branch off `main` (`feature/…`, `fix/…`).
2. Keep changes focused — one PR per logical change.
3. Build and test locally before opening the PR (see below).
4. Open a PR against `main` and fill in the template.
5. A maintainer will review as time allows.

### Code style

- **Java**: 4-space indent, no tabs. Prefer constructor injection and `@Named` / `@ComponentImport` (Atlassian Spring Scanner 2.x).
- **JavaScript**: 2-space indent, semicolons, single quotes. No framework — vanilla ES modules bundled by Vite.
- **CSS**: 2-space indent, class names prefixed `markdownx-` to avoid collisions with Bitbucket's own styles.
- Prefer user-visible strings in `src/main/resources/i18n/markdownx.properties` when practical.

### Build

```bash
cd frontend && npm install && npm run build && cd ..
export JAVA_HOME=/path/to/jdk21
mvn package -DskipTests
```

### Testing

Unit tests live in `src/test/java` and run with `mvn test` (or as part of `mvn package`). CI runs the full build on every pull request. Before opening a PR please also:

1. Build the plugin (above).
2. Start the bundled Bitbucket and install the JAR:
   ```bash
   cd docker && docker compose up -d
   ./deploy-plugin.sh admin admin
   ```
3. Open a test Markdown file containing Mermaid, PlantUML, and LaTeX blocks in file view, file browser, a pull request, and a commit. Verify rendering.

Please describe your manual test steps in the PR.

### Review process

Maintainers review PRs as time allows — typically within a week, but no hard SLA. We may ask for changes; small follow-up commits are fine (squashing happens at merge time).

## Releases

Releases are cut by the maintainers. Each GitHub Release attaches the built plugin JAR as a downloadable artifact.

## Code of Conduct

This project follows the [Contributor Covenant 2.1](CODE_OF_CONDUCT.md). By participating you agree to abide by its terms.
