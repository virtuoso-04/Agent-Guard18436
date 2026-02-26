# Phase 1 — Code Review & Production Fixes

This document covers the code review performed before merging the `nayak` branch into `sub-master`, the issues found at each severity level, and exactly what was changed to fix them.

---

## Review Summary

| Severity | Count | All Fixed? |
|----------|-------|-----------|
| 🔴 Critical bug | 3 | ✅ Yes |
| 🟡 Medium (quality / correctness) | 4 | ✅ Yes |
| 🔵 Low (cleanup / dead code) | 1 | ✅ Yes |
| **Total** | **8** | ✅ All fixed |

---

## 🔴 Critical Bugs

### Bug 1 — Race condition in `addStateMessage`

**File:** `chrome-extension/src/background/agent/messages/service.ts`

**What was wrong:**

The original code started an async HMAC-signing operation, then added the message to history synchronously, then when the signing completed it found the message to update by looking at `msgs[msgs.length - 1]` — the last element in the history array at the time of resolution:

```typescript
// BEFORE (broken)
this.buildProvenance(...).then(provenance => {
  const msgs = this.history.messages;
  if (msgs.length > 0) {
    msgs[msgs.length - 1].metadata.provenance = provenance; // ← wrong message if another was added
  }
});
this.addMessageWithTokens(stateMessage); // added synchronously after async starts
```

**Why it was a problem:**

JavaScript is single-threaded, but async operations interleave at `await` points. If another message was added to history between the `addMessageWithTokens` call and the `.then()` callback resolving, `msgs[msgs.length - 1]` would point to the newly added message — not the state message we intended to sign. The provenance would be attached to the wrong message, silently corrupting the security audit trail.

There was also no `.catch()` handler — if signing failed (e.g. Web Crypto API error), the error was silently swallowed.

**Fix:**

Add the message to history first (synchronously), capture a direct reference to its metadata object before any async work begins, then attach the provenance to that specific reference when signing completes:

```typescript
// AFTER (fixed)
// Add first so its metadata object exists in history
this.addMessageWithTokens(stateMessage);

// Capture a direct reference — immune to any future array index shifts
const insertedMetadata = this.history.messages[this.history.messages.length - 1].metadata;

this.buildProvenance(contentStr, MessageOrigin.PAGE_CONTENT, { sourceUrl })
  .then(provenance => {
    insertedMetadata.provenance = provenance; // always the right message
  })
  .catch(err => {
    logger.error('Failed to build provenance for state message:', err);
  });
```

---

### Bug 2 — Multi-character key breaking the confusables regex

**File:** `chrome-extension/src/background/services/guardrails/confusables.ts`

**What was wrong:**

The `CONFUSABLES_MAP` contained this entry:

```typescript
'\u0443\u0301': 'y', // у́ CYRILLIC SMALL LETTER U + combining acute
```

`'\u0443\u0301'` is a **two-character sequence** (U+0443 = Cyrillic У, U+0301 = combining acute accent). The `CONFUSABLES_REGEX` is built by putting all map keys inside a character class `[...]`:

```typescript
const CONFUSABLES_REGEX = new RegExp(
  `[${Object.keys(CONFUSABLES_MAP).map(ch => ch.replace(...)).join('')}]`,
  'g',
);
```

A character class `[...]` matches **exactly one code point**. A two-character sequence inside a character class is interpreted as two separate alternatives — meaning the regex would match either `\u0443` alone **or** `\u0301` alone, not the sequence. Since `\u0443` was already mapped separately (to `'y'`), the combining-accent entry was doing nothing useful, and the stray `\u0301` match could incorrectly replace a standalone combining acute character that appears in legitimate content.

**Why it was silent:**

The regex compiled without error. The broken behavior (matching each character independently) was indistinguishable from correct behavior in most test cases — the tests didn't specifically check for the combining-accent attack vector.

**Fix:**

Remove the two-character entry. The sanitizer already runs NFKC normalization in Step 1, which decomposes `у́` (precomposed or combining) to just `у` (U+0443). By the time the confusables map is applied in Step 3, the combining accent no longer exists. U+0443 is already handled by its standalone entry:

```typescript
'\u0443': 'y', // у  CYRILLIC SMALL LETTER U  ← this entry handles it
// The combining-acute variant is decomposed by NFKC in Step 1
```

---

### Bug 3 — `modified` flag computed before post-pass cleanup

**File:** `chrome-extension/src/background/services/guardrails/sanitizer.ts`

**What was wrong:**

The `sanitizeContent` function computed `wasModified` before running the post-pass cleanup step:

```typescript
// BEFORE (broken)
const wasModified = current !== content; // ← computed here

if (wasModified || mixedScript) {       // cleanup may further change `current`
  current = current
    .replace(/[^\S\r\n]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  current = cleanEmptyTags(current);
}

return {
  sanitized: current,
  threats: Array.from(allThreats),
  modified: wasModified,               // ← stale — doesn't reflect cleanup changes
};
```

**Why it was a problem:**

Consider a page that contains only mixed-script tokens (e.g. the word `sуstem` with a Cyrillic `у`). The homoglyph normalization in Step 3 converts it to `system` — a change. But because the multi-pass loop in Step 5 finds no injection patterns, `current !== content` evaluates to `true` (the NFKC + homoglyph steps did change it). However, if the cleanup in Step 6 then further trims whitespace, that additional change was not captured.

More importantly: if `mixedScript` is `true` but the pattern loop made no changes (`current === content` after Step 5), then `wasModified = false`, yet cleanup still runs and may change `current`. The returned `modified: false` would be a lie — the output string is different from the input.

Callers use `modified` to decide whether to emit a security event and update the security state machine. A false `false` means an attack attempt that only used homoglyphs (no pattern matches) could go unrecorded.

**Fix:**

Move the `modified` comparison to after all transformations are complete:

```typescript
// AFTER (fixed)
if (preCleanup !== content || mixedScript) {
  current = current.replace(...).trim();
  current = cleanEmptyTags(current);
}

// Compare the FINAL output against the original input
return {
  sanitized: current,
  threats: Array.from(allThreats),
  modified: current !== content,  // ← always accurate
};
```

---

## 🟡 Medium Issues

### Issue 4 — SecurityBadge tooltip had no click-outside dismiss

**File:** `pages/side-panel/src/components/SecurityBadge.tsx`

**What was wrong:**

The expanded threat-summary tooltip could only be closed by clicking the badge button again. There was no handler to close it when the user clicked anywhere else on the screen. A user who opened it and then moved on could end up with a stale tooltip obscuring part of the UI.

Additionally, `animate-pulse` was used for the CRITICAL level badge, but bare `animate-pulse` runs regardless of the user's operating system preference for reduced motion. Users with vestibular disorders or motion sensitivity who have enabled `prefers-reduced-motion` in their OS would still see the animation.

**Fix:**

```tsx
// Added useEffect with mousedown listener that closes when clicking outside containerRef
useEffect(() => {
  if (!expanded) return;
  function handleClickOutside(e: MouseEvent) {
    if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
      setExpanded(false);
    }
  }
  document.addEventListener('mousedown', handleClickOutside);
  return () => document.removeEventListener('mousedown', handleClickOutside);
}, [expanded]);

// Changed animate-pulse → motion-safe:animate-pulse
config.pulse ? 'motion-safe:animate-pulse' : ''
```

Also added `aria-expanded` and `aria-haspopup` attributes to the button for proper screen reader semantics.

---

### Issue 5 — Fragile string parsing of `SECURITY_LEVEL_CHANGE` event

**File:** `pages/side-panel/src/SidePanel.tsx`

**What was wrong:**

The background emits security state changes as:

```typescript
emitEvent(Actors.SYSTEM, ExecutionState.SECURITY_LEVEL_CHANGE, `${level}:${count}`)
```

The side panel decoded it as:

```typescript
const [lvlStr, cntStr] = content.split(':');
const newLevel = parseInt(lvlStr, 10) as SecurityLevel;
const newCount = parseInt(cntStr, 10);
if (!isNaN(newLevel)) setSecurityLevel(newLevel);
if (!isNaN(newCount)) setSecurityDetectionCount(newCount);
```

**Why it was a problem:**

`content.split(':')` with no length check assumes the format is always exactly `"N:M"`. If the format ever changes, or if something emits a malformed payload, the destructuring silently produces `undefined` values. More critically: there was no bounds validation on `newLevel`. Any integer value — including negative numbers or values above 3 — could be cast to `SecurityLevel` and set as the badge state, potentially causing the badge to render with an undefined config and throw.

**Fix:**

```typescript
const parts = content.split(':');
if (parts.length >= 2) {
  const newLevel = parseInt(parts[0], 10) as SecurityLevel;
  const newCount = parseInt(parts[1], 10);
  if (!isNaN(newLevel) && newLevel >= SecurityLevel.NORMAL && newLevel <= SecurityLevel.CRITICAL) {
    setSecurityLevel(newLevel);
  }
  if (!isNaN(newCount) && newCount >= 0) {
    setSecurityDetectionCount(newCount);
  }
}
```

---

### Issue 6 — Integration test false-positive threshold too lenient

**File:** `chrome-extension/src/background/services/guardrails/__tests__/integration.test.ts`

**What was wrong:**

```typescript
// BEFORE
it('false positive rate < 20% on benign samples', () => {
  // Note: we allow up to 20% FP since some benign phrases may overlap with patterns.
  // Production tuning should push this below 5%.
  expect(fpRate).toBeLessThan(0.2);
});
```

A 20% false positive rate means the sanitizer could flag and modify 1 in 5 completely benign user requests. The comment even acknowledged that 5% was the real target — but the enforcement was left at 20%, meaning a badly regressed sanitizer would still pass CI.

**Fix:**

```typescript
// AFTER
it('false positive rate < 5% on benign samples', () => {
  // 5% is production-grade. Raise the bar as patterns are tuned.
  const falsePositives: string[] = [];
  for (const entry of benignPayloads) {
    const threats = detectThreats(entry.payload, false);
    if (threats.length > 0) falsePositives.push(`[${entry.id}] "${entry.payload}"`);
  }
  if (falsePositives.length > 0) {
    console.warn('False positives on benign samples:\n' + falsePositives.join('\n'));
  }
  expect(fpRate).toBeLessThan(0.05);
});
```

The test now also logs exactly which benign samples were flagged, making it easy to tune patterns when the threshold is approached.

---

## 🔵 Low Priority

### Issue 7 — Dead code: `securityLevelColor` and `securityLevelLabel`

**File:** `chrome-extension/src/background/services/guardrails/securityState.ts`

**What was wrong:**

Two exported functions were defined but never imported or called anywhere in the codebase:

```typescript
export function securityLevelLabel(level: SecurityLevel): string { ... }
export function securityLevelColor(level: SecurityLevel): string { ... }
```

The `SecurityBadge` component uses its own `LEVEL_CONFIG` object (co-located in the component file) for display strings and Tailwind color tokens. These functions in `securityState.ts` were likely written speculatively and never wired up.

Dead exports in a background service-worker file add confusion about where the "source of truth" for display logic lives.

**Fix:**

Both functions were removed. A comment explains why display helpers belong in the component, not the state module:

```typescript
// Note: display helpers (label/colour) live in SecurityBadge.tsx (LEVEL_CONFIG)
// where they are co-located with the UI that consumes them, avoiding a
// cross-package import from the background service worker to the side panel.
```

---

## Removed: `demo/` Directory

**Commit message that added it:** `"demo: add local injection attack demo pages for live presentation"`

Five HTML files (`demo-a.html` through `demo-e.html`) were committed at the repository root for use in a live demonstration of injection attacks. These files have no production purpose and were removed entirely.

**Why this matters:** Any file committed to a production branch ships with the extension ZIP or is accessible in the repository. Keeping presentation-only artifacts in the production branch:
- Inflates the extension package size
- Creates confusion about what is and isn't application code
- Could be a future source of unintended behavior if accidentally loaded

---

## What Was NOT Changed

The following were noted during review but left as-is with explanations:

| Item | Reason not changed |
|------|-------------------|
| `SecurityLevel` enum defined in both `securityState.ts` and `SecurityBadge.tsx` | Chrome extension Manifest V3 bundles the background service worker and the side panel as completely separate JS bundles — they cannot share TypeScript types at runtime. The duplicate values are identical by design and documented in `architecture.md`. |
| `threatLogStore.append()` not called anywhere | This is intentional Phase 2 work. The storage layer and types exist and are tested; the write path from the sanitizer to the log is the next item in the roadmap. |
| HMAC not verified on message read | Phase 2 work. The HMAC is written and stored; verification on read (tamper detection) requires additional executor-level plumbing. |

---

## Final State After Review

| Metric | Value |
|--------|-------|
| Test files | 3 |
| Total tests | 61 |
| Test result | ✅ All passing |
| False positive rate (benign corpus) | 0% (0/5 benign samples flagged) |
| Build result | ✅ Clean |
| Files changed in review commit | 12 |
| Lines added | +73 |
| Lines removed | −130 |

The branch was merged into `sub-master` with a `--no-ff` merge commit on `2026-02-26`.
