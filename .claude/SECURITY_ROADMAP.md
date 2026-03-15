# Agent Guard Security Hardening Roadmap

## Overview

This document defines the four-phase security hardening program for Agent Guard. Each phase is a **production-ready, self-contained milestone** with its own unit and integration tests, shipped incrementally so the extension remains stable and deployable throughout.

The threat model is grounded in a real security audit of the existing codebase. Agent Guard is uniquely exposed: it runs LLMs over live web content, executes real browser actions, handles sensitive credentials, and is exposed to adversarial page content on every task. Standard web security is insufficient — the attack surface includes the LLM reasoning layer itself.

---

## Phase 1 — Prompt Injection Defense & Content Integrity

**Objective:** Make it cryptographically and semantically hard for adversarial web content to hijack agent behavior.

**The Problem Today:**
The current guardrails system is regex-only, applied once at content ingestion, and never re-checked. Unicode homoglyph substitutions, nested-tag tricks, and non-breaking spaces all bypass it. Worse, content that enters the message history is never re-sanitized — a single poisoned page can corrupt the entire task's reasoning context. The planner agent also receives full browser state *before* any filtering, meaning the LLM decision is made on potentially hostile input.

**What Ships at End of Phase 1:**
- A hardened, multi-pass content sanitization engine (recursive convergence, Unicode normalization, homoglyph detection, entropy scoring)
- TOON (Tree-of-Object-Notation) as an alternative to JSON for structured agent communication, with schema pinning that resists injection
- Cryptographic message provenance tagging — every message is origin-stamped (user / system / untrusted-page / agent) and the stamp cannot be forged by page content
- An immutable append-only threat audit log persisted to Chrome local storage
- A graduated response system: detection of an injection attempt increases sanitization strictness for the remainder of the task
- Full Vitest unit test suite covering all sanitization paths + integration tests covering real injection payloads from known prompt injection datasets

**Why It Matters:** This is table stakes. Every subsequent phase depends on being able to trust what the agent sees.

---

## Phase 2 — Zero-Click Attack Prevention & DOM Integrity

**Objective:** Eliminate the class of attacks where adversarial page content causes the agent to take unintended real-world actions without the user ever approving them.

**The Problem Today:**
The Navigator executes actions (click, type, navigate) purely on LLM instruction. Element references are unstable numeric indexes with no cryptographic binding to the actual DOM element — a page can inject new elements to shift indexes after the agent plans but before it acts. There is no confirmation gate for high-consequence actions (form submission, file upload, tab navigation, purchases). The DOM representation fed to the LLM includes event handlers and attribute values that may contain sensitive data or additional injected instructions.

**What Ships at End of Phase 2:**
- Cryptographically-bound element identity: each interactive element gets a content-hash fingerprint at `getState()` time, verified at action execution time — index-shifting attacks fail at the verification step
- High-consequence action classification and mandatory confirmation flow: a configurable set of action types (submit, file upload, close tab, navigate to new origin) require a user approval step before execution
- DOM sanitization pipeline: attribute filtering that strips event handlers, detects sensitive field values (passwords, tokens, SSNs in `value`/`placeholder`), and marks them as tainted before they reach the LLM
- Race condition elimination: atomic state-snapshot-to-action locking that prevents DOM mutation between planning and execution
- Structured security event stream: every blocked or flagged action is emitted as a typed `SecurityEvent` visible in the side panel
- Full test suite covering DOM mutation attacks, index-shift scenarios, and element hash verification

**Why It Matters:** Zero-click attacks are the most dangerous class — they cause real-world harm (money moved, data submitted, accounts compromised) with no user interaction.

---

## Phase 3 — Phishing Detection & Navigation Trust

**Objective:** Give the agent real-time awareness of phishing sites, credential harvesting pages, and malicious redirects — and prevent it from operating on them.

**The Problem Today:**
The firewall is user-configured URL allow/deny lists with no intelligence. It does exact and suffix domain matching only — no wildcard, no path-level rules, no redirect chain analysis. The agent happily navigates to lookalike domains (`paypa1.com`, `g00gle.com`) and will fill in forms on them if instructed. There is no passive detection of phishing signals in page content (fake login overlays, urgency language, mismatched domain/title, certificate anomalies). There is no redirect chain audit — a whitelisted domain can 302 to a malicious one and the firewall passes it.

**What Ships at End of Phase 3:**
- Heuristic phishing signal detector: analyzes page content for phishing indicators (domain/title mismatch, lookalike domain scoring with Levenshtein + homoglyph distance against a top-1000 domain list, urgency language patterns, fake login overlay detection, mismatched favicon)
- Redirect chain auditing: tracks the full navigation path including 301/302/meta-refresh hops; any hop that crosses a trust boundary (whitelisted → unlisted) raises a `NavigationTrustEvent`
- URL reputation scoring integrated into the firewall: each navigation decision produces a trust score (0–100); score below threshold either blocks or requires confirmation
- Credential field protection: before the agent types into any password/token/sensitive field, cross-check the current domain against the originating task context — if domain doesn't match, raise an alert
- Certificate and protocol enforcement: HTTPS required for any action that involves form submission or credential input; HTTP-only pages are flagged
- Integration tests using a local mock server with known phishing page patterns; unit tests for all scoring heuristics

**Why It Matters:** As Agent Guard is used for more sensitive tasks (logging into accounts, filling forms, making purchases), phishing is the highest-likelihood real-world attack.

---

## Phase 4 — Model Poisoning Resistance & Behavioral Integrity Monitoring

**Objective:** Detect when the agent's reasoning has been corrupted over the lifetime of a task, and give operators tools to audit, alert on, and contain model poisoning attempts.

**The Problem Today:**
There is no concept of task-level behavioral integrity. Once content enters the message history, it influences all future reasoning without any cross-checking. Sophisticated attackers can stage a poisoning attack across multiple pages — each individually innocuous, collectively steering the agent toward a goal different from the user's original intent. There is no baseline of what "normal" looks like for a task, no detection of goal drift, and no way to compare what the agent did against what the user asked. The replay system stores history but applies no integrity verification to it.

**What Ships at End of Phase 4:**
- Task intent anchoring: the original user task is embedded as a signed, immutable reference; at each planner step, the planner's `next_steps` are scored for semantic alignment with the original intent using an embedding similarity check — drift above threshold raises a `GoalDriftEvent`
- Behavioral anomaly detection: statistical model over action patterns (action type frequency, navigation domain graph, input field targeting) that flags deviations from expected behavior for a given task class
- TOON-based structured reasoning traces: all agent reasoning steps are serialized in TOON (not free-text JSON) with a schema that explicitly captures stated intent, observed state, and chosen action — making reasoning auditable and tamper-evident
- Poisoning attempt timeline: a per-task security timeline UI in the side panel showing all `SecurityEvent`, `ThreatEvent`, `NavigationTrustEvent`, and `GoalDriftEvent` events in chronological order with severity indicators
- Replay integrity verification: when replaying a saved history, each step is re-verified against its original element hash and action schema before execution — tampered histories fail with a `ReplayIntegrityError`
- Operator dashboard in the options page: aggregate view of security events across sessions, threat frequency by type, most-targeted domains, blocked action counts

**Why It Matters:** This is the layer that turns security from reactive (block known bad) to proactive (detect novel attacks, give operators visibility). It's also what makes Agent Guard enterprise-deployable.

---

## Deliverables Summary

| Phase | Ships | Tests Required |
|-------|-------|----------------|
| 1 | Multi-pass sanitization engine, TOON format, message provenance, threat audit log, graduated response | Unit: all sanitizer paths, TOON parser; Integration: injection payload suite |
| 2 | Element hash fingerprinting, action confirmation gate, DOM sanitization pipeline, atomic action locking, security event stream | Unit: hash verification, DOM taint; Integration: DOM mutation attack scenarios |
| 3 | Phishing heuristic detector, redirect chain auditor, URL reputation scoring, credential field protection, HTTPS enforcement | Unit: scoring heuristics, redirect parser; Integration: mock phishing server suite |
| 4 | Intent anchoring, behavioral anomaly detection, TOON reasoning traces, poisoning timeline UI, replay integrity, operator dashboard | Unit: embedding similarity, anomaly model; Integration: multi-step poisoning scenarios |

---

## Architectural Constraints

- All phases must remain compatible with **Manifest V3** (no persistent background pages, service worker lifecycle awareness required)
- No new remote services introduced in Phases 1–3; Phase 4 may introduce an optional embedding endpoint
- Chrome storage (`local`) is the only persistence layer; no external database
- All new code follows existing TypeScript strict mode, ESLint, and Prettier config
- Each phase ships with a `SECURITY.md` update documenting the new threat mitigations
- Test files live in `chrome-extension/src/**/__tests__/` using Vitest
