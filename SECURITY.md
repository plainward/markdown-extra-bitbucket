# Security Policy

## Supported Versions

Only the latest minor release on `main` receives security fixes.

| Version | Supported |
|---------|-----------|
| 1.0.x   | :white_check_mark: |
| < 1.0   | :x: |

## Reporting a Vulnerability

**Please do not open a public GitHub issue for security reports.**

Email the maintainers at **admin@plainward.com** with:

- A description of the issue and the impact you expect
- Steps to reproduce (proof of concept if you have one)
- The affected version(s) of MarkdownX and Bitbucket Data Center
- Any relevant logs, redacted of secrets

### What to expect

- **Acknowledgement**: within 3 business days.
- **Initial triage**: within 10 business days — we will confirm whether the report is in scope and share a rough timeline.
- **Fix and disclosure**: coordinated with the reporter. For confirmed vulnerabilities we aim to ship a patched release and a public advisory within 60 days of the initial report.

## Scope

In scope:

- Any unauthenticated or unauthorized access to data managed by MarkdownX.
- Injection (XSS, HTML injection, server-side) introduced by MarkdownX's rendering pipeline.
- Privilege escalation via the MarkdownX REST API or admin SPA.
- Server-side resource abuse via PlantUML rendering.

Out of scope:

- Issues in Bitbucket Data Center itself (report those to Atlassian).
- Issues in third-party libraries we bundle (please report upstream; we will update our bundle).
- Social-engineering attacks on maintainers.
- Denial-of-service via deliberately pathological Mermaid/PlantUML/LaTeX input from authorized users with diagram-embedding permission.

Thanks for helping keep MarkdownX users safe.
