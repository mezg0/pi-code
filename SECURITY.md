# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in pi-code, please report it responsibly.

**Do not open a public GitHub issue for security vulnerabilities.**

Instead, please email the maintainers directly or use [GitHub's private vulnerability reporting](https://docs.github.com/en/code-security/security-advisories/guidance-on-reporting-and-writing-information-about-vulnerabilities/privately-reporting-a-security-vulnerability) feature on this repository.

### What to Include

- A description of the vulnerability
- Steps to reproduce the issue
- The potential impact
- Any suggested fixes (if applicable)

### Response Timeline

- **Acknowledgment** — We aim to acknowledge reports within 48 hours.
- **Assessment** — We will assess the severity and impact within 1 week.
- **Fix** — Critical issues will be prioritized and patched as quickly as possible.
- **Disclosure** — We will coordinate disclosure timing with the reporter.

## Supported Versions

| Version | Supported |
|---------|-----------|
| Latest  | ✅        |

## Security Considerations

pi-code is a desktop application that:

- Executes AI agent sessions that can read/write files and run commands on your machine.
- Manages API keys for AI providers (stored as environment variables, not by the app).
- Embeds a terminal with full shell access.
- Can fetch content from URLs during conversations.

Users should be aware that AI agent actions operate with the same permissions as the running user. Review agent actions before accepting changes, especially in sensitive environments.
