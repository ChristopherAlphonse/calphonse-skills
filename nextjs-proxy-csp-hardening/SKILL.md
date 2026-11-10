---
name: nextjs-proxy-csp-hardening
description: >
  Build and review secure Next.js proxy.ts files that apply Content Security
  Policy, nonce-based script protection, and browser security headers. Use when
  adding CSP to a Next.js App Router project, migrating from middleware.ts to
  proxy.ts, or hardening an application against XSS, clickjacking, script
  injection, form hijacking, and unsafe browser capabilities. Also holds CSP bypass
  techniques (nonce leakage, trusted-endpoint abuse, exfiltration) for authorized policy testing.
---

# SKILL: Next.js Proxy CSP Hardening

> **AI LOAD INSTRUCTION**: Use this skill when the user asks for a secure `proxy.ts`, CSP headers, nonce-based script handling, security headers, or migration from `middleware.ts` to `proxy.ts` in a Next.js application. Prioritize defensive configuration. Do not weaken CSP unless the user clearly identifies a real framework or third-party integration requirement. Always include the no-fallback CSP directives: `base-uri`, `object-src`, `form-action`, and `frame-ancestors`.

---

## 0. PURPOSE

This skill helps create a secure `proxy.ts` file for a Next.js application.

The goal is to:

- Add a strict Content Security Policy.
- Generate a unique nonce per request.
- Pass the nonce into the application through request headers.
- Apply CSP to the browser response.
- Add browser security headers.
- Avoid common CSP mistakes.
- Keep development mode usable without weakening production.

This skill is defensive. It is for hardening a Next.js app, not for bypassing CSP.

---

## 1. WHEN TO USE THIS SKILL

Use this skill when the user asks for:

- A Next.js `proxy.ts` file.
- A secure CSP for Next.js.
- A nonce-based CSP.
- Help migrating `middleware.ts` to `proxy.ts`.
- Security headers for a Next.js app.
- Protection against XSS.
- Protection against clickjacking.
- Protection against unsafe forms.
- Protection against untrusted embedded content.
- A safer replacement for `unsafe-inline`.
- A production-ready security header setup.

Do not use this skill for:

- Writing exploit payloads.
- Bypassing a third-party CSP.
- Exfiltrating data.
- Testing someone else's application without authorization.
- Weakening application security for convenience.

---

## 2. KEY NEXT.JS FILE CONVENTION

Next.js uses `proxy.ts` for request interception.

The file should usually live in one of these locations:

```txt
proxy.ts
src/proxy.ts
```

Use this shape:

```ts
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export function proxy(request: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
```

---

## 3. SECURITY GOALS

The `proxy.ts` file should protect the app by default.

The baseline goals are:

1. Only allow scripts from trusted sources.
2. Prefer nonce-based scripts over `unsafe-inline`.
3. Avoid `unsafe-eval` in production.
4. Block plugins and embedded legacy content.
5. Restrict the `<base>` element.
6. Restrict form submission targets.
7. Prevent clickjacking.
8. Limit browser APIs through `Permissions-Policy`.
9. Avoid leaking referrer data.
10. Prevent MIME sniffing.

---

## 4. CSP DIRECTIVES TO ALWAYS CONSIDER

These directives are especially important.

| Directive         | Purpose                                        | Recommended Default                       |
| ----------------- | ---------------------------------------------- | ----------------------------------------- |
| `default-src`     | Fallback for many fetch directives             | `'self'`                                  |
| `script-src`      | Controls JavaScript execution                  | `'self' 'nonce-{nonce}' 'strict-dynamic'` |
| `style-src`       | Controls CSS                                   | `'self' 'nonce-{nonce}'`                  |
| `img-src`         | Controls image loading                         | `'self' blob: data: https:`               |
| `font-src`        | Controls fonts                                 | `'self' data:`                            |
| `connect-src`     | Controls fetch, XHR, WebSocket                 | `'self'`                                  |
| `media-src`       | Controls audio and video                       | `'self'`                                  |
| `frame-src`       | Controls frames created by the app             | `'self'`                                  |
| `object-src`      | Controls `<object>`, `<embed>`, and `<applet>` | `'none'`                                  |
| `base-uri`        | Controls the `<base>` element                  | `'self'`                                  |
| `form-action`     | Controls where forms can submit                | `'self'`                                  |
| `frame-ancestors` | Controls who can frame the page                | `'none'`                                  |

Important rule:

`base-uri`, `form-action`, and `frame-ancestors` do not safely fall back to `default-src`. Always set them explicitly.

---

## 5. DEFAULT RECOMMENDED PROXY.TS

Use this when the user wants a complete secure starter file.

```ts
// proxy.ts
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const isDevelopment = process.env.NODE_ENV !== "production";

function createNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);

  return btoa(String.fromCharCode(...bytes));
}

function buildContentSecurityPolicy(nonce: string): string {
  const directives = [
    `default-src 'self'`,

    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' ${
      isDevelopment ? "'unsafe-eval'" : ""
    }`,

    `style-src 'self' 'nonce-${nonce}'`,

    `img-src 'self' blob: data: https:`,

    `font-src 'self' data:`,

    `connect-src 'self' ${isDevelopment ? "ws: wss:" : ""}`,

    `media-src 'self'`,

    `frame-src 'self'`,

    `object-src 'none'`,

    `base-uri 'self'`,

    `form-action 'self'`,

    `frame-ancestors 'none'`,

    `upgrade-insecure-requests`,
  ];

  return directives
    .join("; ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function applySecurityHeaders(response: NextResponse): NextResponse {
  response.headers.set("X-Content-Type-Options", "nosniff");

  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");

  response.headers.set(
    "Permissions-Policy",
    [
      "camera=()",
      "microphone=()",
      "geolocation=()",
      "payment=()",
      "usb=()",
      "magnetometer=()",
      "gyroscope=()",
      "accelerometer=()",
    ].join(", "),
  );

  return response;
}

export function proxy(request: NextRequest) {
  const nonce = createNonce();
  const contentSecurityPolicy = buildContentSecurityPolicy(nonce);

  const requestHeaders = new Headers(request.headers);

  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", contentSecurityPolicy);

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  response.headers.set("Content-Security-Policy", contentSecurityPolicy);

  return applySecurityHeaders(response);
}

export const config = {
  matcher: [
    {
      source:
        "/((?!api|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)",
      missing: [
        {
          type: "header",
          key: "next-router-prefetch",
        },
        {
          type: "header",
          key: "purpose",
          value: "prefetch",
        },
      ],
    },
  ],
};
```

---

## 6. USING THE NONCE IN SERVER COMPONENTS

When using `next/script`, read the nonce from headers.

```tsx
import { headers } from "next/headers";
import Script from "next/script";

export default async function Page() {
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  return (
    <Script
      src="/scripts/third-party.js"
      nonce={nonce}
      strategy="afterInteractive"
    />
  );
}
```

Only use this pattern for scripts that actually need to run on the page.

---

## 7. WHEN TO LOOSEN THE CSP

Start strict. Loosen only when something breaks and there is a real reason.

Common cases:

| Problem                    | Safer Fix                                     | Avoid                                |
| -------------------------- | --------------------------------------------- | ------------------------------------ |
| Third-party script blocked | Add the exact script domain if required       | Adding `*`                           |
| Inline script blocked      | Use a nonce                                   | Adding `unsafe-inline`               |
| Dev mode breaks            | Allow `unsafe-eval` only in development       | Allowing `unsafe-eval` in production |
| CSS-in-JS breaks           | Try nonce support first                       | Permanent `unsafe-inline`            |
| External API blocked       | Add exact API origin to `connect-src`         | Broad `https:` in `connect-src`      |
| App must be embedded       | Set exact allowed parent in `frame-ancestors` | Removing `frame-ancestors`           |

---

## 8. EXAMPLES FOR THIRD-PARTY SERVICES

Only add the services your app actually uses.

### Stripe

```ts
`script-src 'self' 'nonce-${nonce}' 'strict-dynamic' PAYMENTS_SCRIPT_HOST`,
`frame-src 'self' PAYMENTS_SCRIPT_HOST PAYMENTS_HOOKS_HOST`,
`connect-src 'self' PAYMENTS_API_HOST`,
```

### Google Analytics

```ts
`script-src 'self' 'nonce-${nonce}' 'strict-dynamic' TAG_MANAGER_HOST`,
`connect-src 'self' ANALYTICS_HOST ANALYTICS_REGION_HOST`,
`img-src 'self' blob: data: https: ANALYTICS_HOST`,
```

### PostHog

```ts
`script-src 'self' 'nonce-${nonce}' 'strict-dynamic' PRODUCT_ANALYTICS_HOST`,
`connect-src 'self' PRODUCT_ANALYTICS_HOST PRODUCT_ANALYTICS_US_HOST PRODUCT_ANALYTICS_EU_HOST`,
`img-src 'self' blob: data: https:`,
```

### Sentry

```ts
`connect-src 'self' ERROR_TRACKING_HOST`,
```

---

## 9. PRODUCTION VS DEVELOPMENT

Development can be more permissive because Next.js tooling may need extra capabilities.

Development can allow:

```ts
'unsafe-eval'
ws:
wss:
```

Production should avoid:

```txt
unsafe-inline
unsafe-eval
*
data: in script-src
http:
```

Production should prefer:

```txt
nonce-based scripts
specific domains
object-src 'none'
base-uri 'self'
form-action 'self'
frame-ancestors 'none'
```

---

## 10. COMMON CSP MISTAKES TO AVOID

### Mistake 1: Relying only on default-src

Bad:

```txt
default-src 'self'
```

Better:

```txt
default-src 'self';
base-uri 'self';
form-action 'self';
frame-ancestors 'none';
object-src 'none'
```

### Mistake 2: Using unsafe-inline in production

Bad:

```txt
script-src 'self' 'unsafe-inline'
```

Better:

```txt
script-src 'self' 'nonce-{nonce}' 'strict-dynamic'
```

### Mistake 3: Allowing all HTTPS scripts

Bad:

```txt
script-src 'self' https:
```

Better:

```txt
script-src 'self' 'nonce-{nonce}' 'strict-dynamic'
```

### Mistake 4: Forgetting frame-ancestors

Bad:

```txt
default-src 'self'
```

Better:

```txt
default-src 'self';
frame-ancestors 'none'
```

### Mistake 5: Using Node APIs in proxy.ts

Avoid this in `proxy.ts`:

```ts
import crypto from "node:crypto";
Buffer.from("value");
```

Use Web Crypto instead:

```ts
const bytes = new Uint8Array(16);
crypto.getRandomValues(bytes);
```

---

## 11. REVIEW CHECKLIST

When reviewing a `proxy.ts` file, verify:

- It imports from `next/server`.
- It exports `proxy`, not `middleware`.
- It uses `NextResponse.next()`.
- It generates a fresh nonce per request.
- It uses Web Crypto, not Node crypto.
- It sets `x-nonce` on request headers.
- It sets `Content-Security-Policy` on the response.
- It avoids `unsafe-inline` in production.
- It avoids `unsafe-eval` in production.
- It includes `object-src 'none'`.
- It includes `base-uri 'self'`.
- It includes `form-action 'self'`.
- It includes `frame-ancestors 'none'`.
- It sets `X-Content-Type-Options`.
- It sets `Referrer-Policy`.
- It sets `Permissions-Policy`.
- It excludes static assets in `config.matcher`.
- It does not accidentally block required API routes.
- It does not use broad wildcards.

---

## 12. DEBUGGING CSP ISSUES

If the app breaks after adding CSP:

1. Open Chrome DevTools.
2. Go to the Console tab.
3. Look for CSP violation messages.
4. Identify the blocked directive.
5. Add the narrowest possible allowlist entry.
6. Avoid adding global exceptions.
7. Retest in production mode.

Use this command to test production behavior locally:

```bash
npm run build
npm run start
```

Do not rely only on `npm run dev`, because development mode may require looser CSP rules.

---

## 13. SAFE RESPONSE PATTERNS

When the user asks for a secure Next.js CSP, provide:

1. A full `proxy.ts`.
2. A short explanation of what it protects.
3. A warning about third-party services.
4. A note that `unsafe-eval` should be development-only.
5. A reminder to test in production mode.

Example response:

```txt
Here is a secure starter proxy.ts for Next.js. It uses a per-request nonce, applies CSP to the browser response, blocks object/embed content, restricts base-uri and form-action, and prevents clickjacking with frame-ancestors.
```

---

## 14. UNSAFE RESPONSE PATTERNS

Do not suggest these as defaults:

```txt
script-src *;
script-src 'self' 'unsafe-inline' 'unsafe-eval';
default-src * data: blob:;
frame-ancestors *;
object-src *;
form-action *;
```

Do not remove these unless the user has a specific, legitimate need:

```txt
object-src 'none'
base-uri 'self'
form-action 'self'
frame-ancestors 'none'
```

---

## 15. FINAL OUTPUT TEMPLATE

When asked for the full file, return this structure:

```txt
Here is the full proxy.ts:
```

Then provide the complete code.

When asked for a reusable skill, return:

```txt
Here is the full SKILL.md:
```

Then provide the complete markdown.

---

## 16. BEST DEFAULT

If the user does not provide app-specific requirements, use this default policy:

```txt
default-src 'self';
script-src 'self' 'nonce-{nonce}' 'strict-dynamic';
style-src 'self' 'nonce-{nonce}';
img-src 'self' blob: data: https:;
font-src 'self' data:;
connect-src 'self';
media-src 'self';
frame-src 'self';
object-src 'none';
base-uri 'self';
form-action 'self';
frame-ancestors 'none';
upgrade-insecure-requests
```

In development only, allow:

```txt
script-src 'self' 'nonce-{nonce}' 'strict-dynamic' 'unsafe-eval';
connect-src 'self' ws: wss:
```

---

## 17. QUALITY BAR

A good answer using this skill should be:

- Complete.
- Defensive.
- Practical.
- Copy-paste ready.
- Strict by default.
- Clear about tradeoffs.
- Honest about third-party integrations.
- Compatible with the Edge Runtime.
- Focused on production safety.

A bad answer using this skill:

- Adds `unsafe-inline` without explanation.
- Adds `unsafe-eval` in production.
- Uses wildcard sources.
- Omits `base-uri`.
- Omits `object-src`.
- Omits `form-action`.
- Omits `frame-ancestors`.
- Uses Node-only APIs inside `proxy.ts`.
- Gives offensive CSP bypass steps instead of defensive hardening, unless the user is testing their own policy (see Related).

## Related

- [references/csp-bypass-techniques.md](references/csp-bypass-techniques.md): per-directive bypasses, nonce leakage, trusted-endpoint abuse, exfiltration channels. Read it only to test or review a policy the user owns or is authorized to test. Do not use it to build a policy or to attack a third-party site.
- [scripts/check_csp.py](scripts/check_csp.py): run against `http://localhost:PORT` (or any site you own) to check the live policy for the gaps in that reference — missing `base-uri`/`form-action`/`frame-ancestors`, `unsafe-inline`/`unsafe-eval`/wildcard sources, Report-Only-only, header/meta conflicts. It only reads headers and HTML; it sends no payloads. Needs Python 3.8+, stdlib only; check with `python3 --version` first and tell the user to install it if missing (python.org, or `brew install python3` / the OS package manager) before running `python3 scripts/check_csp.py` (omit the URL to auto-detect a local dev server, or pass one explicitly, e.g. `http://localhost:3000`).

## Red Team / Blue Team / Orchestrator Workflow

Use this when the user wants the policy attacked and fixed, not just reviewed, e.g. "pen-test my CSP", "red team this", "find and fix CSP flaws". Scope: CSP only — this is not a general pen test. Only run against an app the user owns or is explicitly authorized to test (localhost or a site they confirm is theirs).

You are the orchestrator. Do not find or fix flaws yourself — spawn the two agents below with `invoke_sub_agent` (`general-task-execution`), one after the other (blue team needs red team's findings), then check both against OWASP yourself.

### Step 1: Red Team

Spawn one agent with this prompt (fill in `<URL>`):

```
You are a red team CSP tester. Target: <URL>, which the user owns or is authorized to test. Do not test any other host.

1. Run: python3 nextjs-proxy-csp-hardening/scripts/check_csp.py <URL>
2. Read: nextjs-proxy-csp-hardening/references/csp-bypass-techniques.md
3. For every FAIL the script reports, and every gap you find by reading the actual policy
   against that reference (missing directives, risky keywords, nonce reuse across two
   requests), state the concrete bypass it enables, citing the reference section.
4. Do not fix anything. Report findings only.

REPORT FORMAT:
## Red Team Findings
| # | Severity | Directive/Header | Evidence (script FAIL or policy value) | Bypass enabled | Reference section |
|---|----------|------------------|------------------------------------------|-----------------|--------------------|

### Verdict: BLOCK (any exploitable gap) | PASS (none)
```

### Step 2: Blue Team

Spawn one agent, pasting in the Red Team Findings table:

```
You are a blue team CSP fixer. Fix only the findings below — do not scope-creep into unrelated
hardening.

RED TEAM FINDINGS:
<paste table>

1. Read: nextjs-proxy-csp-hardening/SKILL.md (sections 3-10) for the correct directive values
   and the default `proxy.ts` shape.
2. Find the project's proxy.ts (or middleware.ts if not yet migrated) and propose the exact
   diff that closes each finding. Keep every unrelated line unchanged.
3. Do not weaken any directive to "fix" a false positive — if a finding looks wrong, say so
   instead of touching the policy.

REPORT FORMAT:
## Blue Team Fix
| # | Finding | Directive before | Directive after |
|---|---------|-------------------|------------------|

<diff or full file>
```

### Step 3: Orchestrator Compliance Check

With both reports in hand, verify yourself — do not delegate this step:

1. For each Blue Team fix, confirm it actually closes the matching Red Team finding (re-read the diff, don't trust the agent's own claim).
2. Cross-check the resulting policy against `security-review/references/owasp-top-10.md`: CSP work maps mainly to A03 (Injection/XSS) and A05 (Security Misconfiguration) — confirm the fix doesn't leave either open.
3. Confirm the four no-fallback directives (`base-uri`, `object-src`, `form-action`, `frame-ancestors`) are present and not weakened by the fix.
4. Report: findings count, fixes applied, any finding left open and why, and the OWASP mapping checked. Apply the diff only after the user confirms.
