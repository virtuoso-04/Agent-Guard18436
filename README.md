# Agent-Guard

<div align="center">
  <img src="https://github.com/user-attachments/assets/ec60b0c4-87ba-48f4-981a-c55ed0e8497b" alt="Agent-Guard banner" width="420" />

  <p><strong>Security-first AI web automation built for the real browser, not a sandboxed demo.</strong></p>

  <p>
    <a href="https://github.com/virtuoso-04/Agent-Guard18436"><img src="https://img.shields.io/badge/GitHub-Agent--Guard-181717?style=for-the-badge&logo=github&logoColor=white" alt="GitHub" /></a>
    <a href="https://github.com/virtuoso-04/Agent-Guard18436/stargazers"><img src="https://img.shields.io/github/stars/virtuoso-04/Agent-Guard18436?style=for-the-badge" alt="Stars" /></a>
    <a href="https://github.com/virtuoso-04/Agent-Guard18436/issues"><img src="https://img.shields.io/github/issues/virtuoso-04/Agent-Guard18436?style=for-the-badge" alt="Issues" /></a>
    <a href="./LICENSE"><img src="https://img.shields.io/badge/License-Apache%202.0-blue?style=for-the-badge" alt="License" /></a>
  </p>
</div>

---

## What Is Agent-Guard?

Agent-Guard is an open-source, security-hardened browser agent based on the Nanobrowser architecture and reworked with a much stronger security posture.

It combines:

- local-first browser automation
- a multi-agent workflow
- configurable LLM providers
- defensive layers against prompt injection, phishing, unsafe navigation, and model manipulation

The goal is simple: make AI web automation feel powerful without feeling reckless.

## Why I Built It

Most browser agents focus on capability first and safety later. Agent-Guard flips that.

This project is my attempt to build an agent runtime where security is part of the execution loop itself, not just a warning banner on top. Instead of trusting every page, redirect, model output, and DOM state equally, Agent-Guard actively evaluates what is happening and tries to reduce the attack surface while the task is running.

## Core Highlights

- **Security-first runtime**
  Prompt injection defense, phishing-aware navigation checks, DOM integrity checks, and behavioral anomaly detection are built into the flow.
- **Multi-agent orchestration**
  Planner and Navigator agents work together to complete tasks while staying inside security guardrails.
- **Interactive side panel**
  Real-time task state, cleaner UI, security indicators, task history, replay, and suggested prompts.
- **Bring-your-own-model**
  Use OpenAI, Anthropic, Gemini, Ollama, Groq, Cerebras, Llama, and OpenAI-compatible providers.
- **Runs locally in the browser**
  Your browser session and credentials stay with you.
- **Open source and inspectable**
  You can trace how the agent behaves, what protections exist, and where the decisions come from.

## Security Model

Agent-Guard is organized around four security hardening phases:

| Phase | Focus | Status |
| --- | --- | --- |
| Phase 1 | Prompt injection defense, content sanitization, threat logging | Complete |
| Phase 2 | Zero-click attack prevention, DOM integrity, action validation | Complete |
| Phase 3 | Phishing detection, redirect auditing, trust boundary checks | Complete |
| Phase 4 | Model poisoning resistance, intent anchoring, behavior tracing | Complete |

This includes subsystems for:

- content sanitization and threat detection
- DOM taint analysis and fingerprinting
- redirect-chain auditing
- suspicious domain scoring
- credential safety checks
- intent anchoring and anomaly detection
- traceable security event reporting

## UI Preview

<div align="center">
  <img src="https://github.com/user-attachments/assets/112c4385-7b03-4b81-a352-4f348093351b" width="700" alt="Agent-Guard preview" />
  <p><em>Agent-Guard running in the browser with a security-aware side panel and guarded automation flow.</em></p>
</div>

## What Makes This Version Different

This repo is not just a renamed fork.

It includes work on:

- a more opinionated security architecture
- security event surfacing in the UI
- refined side-panel and options UX
- stronger browser-build handling for extension packaging
- additional tests around security-focused behaviors

## Tech Stack

- TypeScript
- React
- Vite
- pnpm workspaces
- Turbo
- Chrome Extension APIs
- Vitest

## Supported Providers

Agent-Guard supports:

- OpenAI
- Anthropic
- Gemini
- Ollama
- Groq
- Cerebras
- Llama
- custom OpenAI-compatible providers

## Browser Support

Officially supported:

- Chrome
- Edge

Other Chromium browsers may work, but they are not the main target for this project.

## Quick Start

### 1. Clone the repo

```bash
git clone https://github.com/virtuoso-04/Agent-Guard18436.git
cd Agent-Guard18436
```

### 2. Install dependencies

```bash
pnpm install
```

### 3. Build the extension

```bash
pnpm build
```

### 4. Load it in Chrome

1. Open `chrome://extensions/`
2. Enable Developer mode
3. Click `Load unpacked`
4. Select the generated `dist/` directory

### 5. Configure models

Open the side panel, go to Settings, add your provider keys, and assign models to the Planner and Navigator.

## Development

Run development mode:

```bash
pnpm dev
```

Useful commands:

```bash
pnpm build
pnpm type-check
pnpm test
pnpm lint
pnpm zip
```

## Recommended Model Setups

### Better performance

- Planner: Claude Sonnet 4
- Navigator: Claude Haiku 3.5

### Budget-friendly

- Planner: GPT-4o or Claude Haiku
- Navigator: Gemini 2.5 Flash or GPT-4o-mini

### Local-first

Use Ollama or another OpenAI-compatible local provider if you want stronger privacy and lower recurring cost.

## Example Tasks

- "Go to TechCrunch and summarize the top headlines from the last 24 hours."
- "Look for trending Python repositories on GitHub with the highest stars."
- "Find a portable Bluetooth speaker under $50 with water resistance and 10+ hours battery life."
- "Compare three coworking spaces in Bangalore with pricing and ratings."

## Repository Structure

```text
chrome-extension/   Main extension manifest and background logic
pages/              Side panel, options page, content page, and UI entrypoints
packages/           Shared workspaces for storage, i18n, UI, HMR, and tooling
tests/              Focused tests for security UI and related flows
```

## Contributing

Contributions are welcome, especially around:

- browser-agent safety
- extension UX
- model integrations
- testing and reliability
- documentation

If you want to contribute, open an issue or submit a pull request.

## Security Disclosure

If you discover a real security vulnerability, please do not disclose it publicly first.

Use a responsible reporting path instead of opening a public exploit issue.

## Acknowledgments

Agent-Guard builds on ideas and tooling from:

- [Nanobrowser](https://github.com/nanobrowser/nanobrowser)
- [Browser Use](https://github.com/browser-use/browser-use)
- [Chrome Extension Boilerplate](https://github.com/Jonghakseo/chrome-extension-boilerplate-react-vite)
- [LangChain](https://github.com/langchain-ai/langchainjs)

## Creator Note

This repo is maintained as my own security-focused browser-agent project and experimentation space.

If you like the direction of the project, star the repo and follow along:

- Repo: https://github.com/virtuoso-04/Agent-Guard18436

## License

Licensed under the Apache License 2.0. See [LICENSE](./LICENSE).
