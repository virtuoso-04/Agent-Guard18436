# Project Context

## What This Is

**Nanobrowser** — an open-source AI web automation Chrome extension. Users type natural language tasks; a local multi-agent system (Planner + Navigator) uses LLMs to control the browser and complete them. Free alternative to OpenAI Operator.

**Current version:** 0.1.13 (from `package.json`)
**Manifest:** Chrome V3 only (Chrome/Edge). No Firefox.

## Supported LLM Providers

OpenAI, Anthropic, Gemini, Groq, Ollama, DeepSeek, Grok, Azure OpenAI, OpenRouter, Cerebras, Llama, Custom OpenAI-compatible.

Each agent (Navigator, Planner) can be assigned a different provider + model independently.

## Key User-Facing Features

- **Chat interface** (side panel) with multi-turn follow-up tasks
- **Conversation history** — sessions persisted to Chrome local storage
- **Favorite prompts** — quick-access bookmarks
- **Speech-to-text** input
- **Task replay** — replay a saved step history
- **Pause/resume/cancel** running tasks
- **Firewall** — URL allowlist/blocklist
- **Dark mode** support
- **Analytics opt-out** (PostHog, respects user preference)

## Chrome Permissions Used

```
storage, scripting, tabs, activeTab, debugger,
unlimitedStorage, webNavigation, sidePanel
host_permissions: <all_urls>
```

The `debugger` permission is significant — it enables Puppeteer-style page control via Chrome DevTools Protocol. Users will see the "Developer tools" warning banner in Chrome.

## Extension Architecture Constraints

- **Manifest V3**: Service workers (not persistent background pages). The background script can be suspended by Chrome between messages — do not rely on in-memory state surviving across separate port connections.
- **Side panel**: Chrome-only API (`chrome.sidePanel`). Opens on extension icon click.
- **Content scripts**: Injected into every `http://` page on `tabs.onUpdated` complete. Currently only injects the DOM tree builder scripts.
- **Chrome messaging**: Long-lived port (`chrome.runtime.connect('side-panel-connection')`) between side panel and background. Strict sender validation — both sender URL and extension ID are checked.

## Limitations to Know

- **One task at a time**: `currentExecutor` is a single global instance in `background/index.ts`. Concurrent tasks are not supported.
- **No cross-device sync**: Everything uses `chrome.storage.local` (not `sync`).
- **Vision off by default**: `useVision: false` in default options. Screenshots are taken but not sent to LLM unless enabled.
- **Token limits**: Default `maxInputTokens: 128,000`. DOM trees for complex pages can be large — the message manager truncates history to stay under limit.
- **Max steps default: 100**: Configurable via general settings. Tasks that need more steps will fail with `MaxStepsReachedError`.

## Repository Health

- TypeScript strict mode everywhere
- ESLint + Prettier enforced
- Vitest unit tests (currently focused on guardrails)
- No CI config visible in workspace — rely on local checks
- Git hooks via Husky (pre-commit)

## Future Development Direction

This codebase is a base for significant expansion. Likely directions:
- Additional specialized agents beyond Navigator + Planner
- Richer action types (file system, browser extensions, APIs)
- Multi-tab coordination
- Better task scheduling / queuing
- Enhanced replay and debugging tools
- Tighter i18n coverage
- E2E test suite expansion
- Possible server-side component for shared task management

When building features, keep them modular, follow existing patterns, and don't break the Manifest V3 service worker constraint.
