# Security policy

Takhtabush is self-hosted authentication and data software. Please report
security issues privately.

## Supported versions

Security fixes land on `main` and are included in the latest tagged release.
Older tags are not maintained.

## Reporting a vulnerability

Use **GitHub private vulnerability reporting** on this repository
(Security → Advisories → Report a vulnerability). Do not open a public issue,
pull request, or discussion for a suspected vulnerability.

Please include:

- the affected area (auth, sessions, OAuth, media, MCP, tenancy, dependencies);
- the version, commit, or deployment method;
- a minimal reproduction or proof of concept;
- the impact you believe it has;
- any suggested fix, if you have one.

Do not include real user data, production secrets, or live access tokens.
Redact them before sending.

## What is in scope

- Magic-link sign-in, session cookies, CSRF handling, and session revocation.
- API keys, OAuth grants, consent, and MCP scope enforcement.
- The R2 media upload and authenticated read proxy.
- Cross-user or cross-workspace data access.
- Server-side request handling, input validation, and SQL construction.
- The MCP tool surface, including audit records.
- Vulnerabilities in dependencies that are reachable from this code.

## What is out of scope

- Misconfiguration of your own deployment (open `SETUP_TOKEN`, weak
  `SESSION_SECRET`, permissive Cloudflare account access, missing WAF rules).
- Denial of service and volumetric attacks.
- Social engineering, phishing, or physical access.
- Self-XSS or issues that require the victim to paste attacker code into
  developer tools.
- Reports produced only by an automated scanner without a demonstrated impact.

## Response

This is a small, unfunded project. We aim to acknowledge a report within
72 hours and to agree on a disclosure timeline with you. Please give us a
reasonable window to ship a fix before publishing details. There is no bug
bounty.

## Operator responsibilities

If you self-host Takhtabush you own the deployment: rotate `SESSION_SECRET`,
`SETUP_TOKEN`, and `OWNER_INVITE_TOKEN`; keep `OWNER_EMAIL` and
`ALLOWED_EMAILS` accurate; restrict Cloudflare dashboard access; and review
D1/R2 permissions. The application cannot protect a deployment whose secrets
are public.
