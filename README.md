<h1 align="center">
    <img src="https://github.com/user-attachments/assets/ec60b0c4-87ba-48f4-981a-c55ed0e8497b" height="100" width="375" alt="banner" /><br>
</h1>

<div align="center">

[![GitHub](#)](#)
[![Twitter](#)](#)
[![Discord](#)](#)

</div>

---

### 🏛️ Foundation
**Agent-Guard** is a security-first AI web automation engine. Built upon the proven multi-agent orchestration of [Nanobrowser](https://github.com/nanobrowser), Agent-Guard introduces a state-of-the-art **Security Abstraction Layer** (SAL) designed to protect users and agents from prompt injection, phishing, and model poisoning.

---

## 🌐 Agent-Guard

Agent-Guard is an open-source, security-hardened AI web automation extension. It provides a robust defense layer directly in the agent runtime, ensuring that your AI agents operate within a verified, tamper-evident environment.

⬇️ [Download Latest Release](https://github.com/TShreek/Agent-Guard18436/releases)

👏 Join the community in [GitHub](https://github.com/TShreek/Agent-Guard18436/discussions)

🌟 Loving Agent-Guard? Give us a star and help spread the word!


<div align="center">
<img src="https://github.com/user-attachments/assets/112c4385-7b03-4b81-a352-4f348093351b" width="600" alt="Agent-Guard Demo" />
<p><em>Agent-Guard's multi-agent system intelligently navigating complex web workflows while maintaining a real-time security perimeter.</em></p>
</div>

## 🔥 Why Agent-Guard?

Looking for a powerful AI browser agent without the $200/month price tag of OpenAI Operator — and one that actually takes security seriously? **Agent-Guard** delivers premium web automation with a security layer built into the agent runtime, not bolted on after:

- **100% Free** - No subscription fees or hidden costs. Use your own API keys and only pay for what you use.
- **Security-First Architecture** - Multi-layer defenses against prompt injection, phishing, zero-click attacks, and model poisoning — running locally alongside the agents that need protecting.
- **Privacy-Focused** - Everything runs in your local browser. Your credentials never leave your machine.
- **Flexible LLM Options** - Connect any preferred provider and assign different models to different agents.
- **Fully Open Source** - Complete transparency in how your browser is automated and how it's secured. No black boxes.

> **Supported providers:** OpenAI, Anthropic, Gemini, Ollama, Groq, Cerebras, Llama, and custom OpenAI-compatible providers.

## 🔐 Security Roadmap

Agent-Guard is building industry-grade security into every layer of the AI agent stack across four production-ready phases:

| Phase | Focus | Status |
|-------|-------|--------|
| **Phase 1** | Prompt Injection Defense & Content Integrity — multi-pass sanitization, TOON format, cryptographic message provenance, threat audit log | ✅ Completed |
| **Phase 2** | Zero-Click Attack Prevention & DOM Integrity — element fingerprinting, action confirmation gate, DOM taint analysis, atomic state locking | ✅ Completed |
| **Phase 3** | Phishing Detection & Navigation Trust — domain lookalike scoring, page heuristics, redirect chain auditing, smart firewall | ✅ Completed |
| **Phase 4** | Model Poisoning Resistance — intent anchoring, behavioral anomaly detection, tamper-evident reasoning traces, operator dashboard | ✅ Completed |

See the full roadmap and open issues: [Security Issues →](https://github.com/TShreek/Agent-Guard18436/issues?q=label%3Asecurity)

## 📊 Key Features

- **Multi-agent System**: Specialized AI agents (Planner + Navigator) collaborate to accomplish complex web workflows
- **Security Event Stream**: Real-time visibility into what the security layer is detecting and blocking
- **Interactive Side Panel**: Intuitive chat interface with real-time status updates and security badge
- **Task Automation**: Seamlessly automate repetitive web tasks across websites, with safety guardrails
- **Follow-up Questions**: Ask contextual follow-up questions about completed tasks
- **Conversation History**: Easily access and manage your AI agent interaction history
- **Task Replay**: Record and replay task execution with full integrity verification
- **Multiple LLM Support**: Connect your preferred LLM providers and assign different models to different agents


## 🌐 Browser Support

**Officially Supported:**
- **Chrome** - Full support with all features
- **Edge** - Full support with all features

**Not Supported:**
- Firefox, Safari, and other Chromium variants (Opera, Arc, etc.)

> **Note**: While Agent Guard may function on other Chromium-based browsers, we recommend using Chrome or Edge for the best experience and guaranteed compatibility.


## 🚀 Quick Start

1. **Configure Agent Models**:
   * Click the Agent Guard icon in your toolbar to open the sidebar
   * Click the **Settings** icon (top right)
   * Add your LLM API keys
   * Choose which model to use for different agents (Navigator, Planner)

> **Tip**: For the latest security patches, ensure you are running the latest version from our [GitHub Releases](https://github.com/TShreek/Agent-Guard18436/releases).

## 🔧 Manually Install Latest Version

To get the most recent security features:

1. **Download**:
    * Download `Agent-Guard.zip` from our [Release Page](https://github.com/TShreek/Agent-Guard18436/releases).

2. **Install**:
    * Unzip the archive.
    * Open `chrome://extensions/` in Chrome.
    * Enable **Developer mode** (top right).
    * Click **Load unpacked** and select the unzipped release folder.

> **Note**: Once installed, click the Agent Guard icon in your toolbar, go to **Settings**, and add your LLM API keys to begin.

4. **Upgrading**:
    * Download the latest `Agent Guard.zip` file from the release page.
    * Unzip and replace your existing Agent Guard files with the new ones.
    * Go to `chrome://extensions/` in Chrome and click the refresh icon on the Agent Guard card.

## 🛠️ Build from Source

If you prefer to build Agent Guard yourself, follow these steps:

1. **Prerequisites**:
   * [Node.js](https://nodejs.org/) (v22.12.0 or higher)
   * [pnpm](https://pnpm.io/installation) (v9.15.1 or higher)

2. **Clone the Repository**:
   ```bash
   git clone https://github.com/TShreek/Agent-Guard18436.git
   cd Agent-Guard18436
   ```

3. **Install Dependencies**:
   ```bash
   pnpm install
   ```

4. **Build the Extension**:
   ```bash
   pnpm build
   ```

5. **Load the Extension**:
   * The built extension will be in the `dist` directory
   * Follow the installation steps from the Manually Install section to load the extension into your browser

6. **Development Mode** (optional):
   ```bash
   pnpm dev
   ```

## 🤖 Choosing Your Models

Agent Guard allows you to configure different LLM models for each agent to balance performance and cost. Here are recommended configurations:

### Better Performance
- **Planner**: Claude Sonnet 4
  - Better reasoning and planning capabilities
- **Navigator**: Claude Haiku 3.5
  - Efficient for web navigation tasks
  - Good balance of performance and cost

### Cost-Effective Configuration
- **Planner**: Claude Haiku or GPT-4o
  - Reasonable performance at lower cost
  - May require more iterations for complex tasks
- **Navigator**: Gemini 2.5 Flash or GPT-4o-mini
  - Lightweight and cost-efficient
  - Suitable for basic navigation tasks

### Local Models
- **Setup Options**:
  - Use Ollama or other custom OpenAI-compatible providers to run models locally
  - Zero API costs and complete privacy with no data leaving your machine

- **Recommended Models**:
  - **Qwen3-30B-A3B-Instruct-2507**
  - **Falcon3 10B**
  - **Qwen 2.5 Coder 14B**
  - **Mistral Small 24B**
  - [Latest test results from community](https://gist.github.com/maximus2600/75d60bf3df62986e2254d5166e2524cb) 
  - We welcome community experience sharing with other local models in our [Discord](https://discord.gg/NN3ABHggMK)

- **Prompt Engineering**:
  - Local models require more specific and cleaner prompts
  - Avoid high-level, ambiguous commands
  - Break complex tasks into clear, detailed steps
  - Provide explicit context and constraints

> **Note**: The cost-effective configuration may produce less stable outputs and require more iterations for complex tasks.

> **Tip**: Feel free to experiment with your own model configurations! Found a great combination? Share it with the community in our [Discord](https://discord.gg/NN3ABHggMK) to help others optimize their setup.

## 💡 See It In Action

Here are some powerful tasks you can accomplish with just a sentence:

1. **News Summary**:
   > "Go to TechCrunch and extract top 10 headlines from the last 24 hours"

2. **GitHub Research**:
   > "Look for the trending Python repositories on GitHub with most stars"

3. **Shopping Research**:
   > "Find a portable Bluetooth speaker on Amazon with a water-resistant design, under $50. It should have a minimum battery life of 10 hours"

## 🛠️ Roadmap

We're actively developing Agent-Guard with exciting features on the horizon — welcome to join us!

**Security hardening** is our current primary focus. Each security phase ships as a standalone, production-ready milestone with its own unit and integration test suite. Track progress in our [Security Issues](https://github.com/TShreek/Agent-Guard18436/issues?q=label%3Asecurity).

For the full feature roadmap and broader discussions, visit our [GitHub Discussions](https://github.com/TShreek/Agent-Guard18436/discussions).

## 🤝 Contributing

**We need your help to make Agent-Guard even better!** Contributions of all kinds are welcome:

*  **Share Prompts & Use Cases** 
   * share how you're using Agent Guard. Help us build a library of useful prompts and real-world use cases.
   * Try Agent Guard and give us feedback on its performance or suggest improvements in our [GitHub Discussions](https://github.com/TShreek/Agent-Guard18436/discussions).
* **Contribute Code**
   * Check out our [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines on how to contribute code to the project.
   * Submit pull requests for bug fixes, features, or documentation improvements.


We believe in the power of open source and community collaboration. Join us in building the future of secure web automation!


## 🔒 Security

Agent-Guard is built with security as a first-class concern. Our [Security Roadmap](.claude/SECURITY_ROADMAP.md) documents our four-phase hardening program covering prompt injection defense, zero-click attack prevention, phishing detection, and model poisoning resistance.

If you discover a security vulnerability, please **DO NOT** disclose it publicly through issues, pull requests, or discussions.

Instead, please create a [GitHub Security Advisory](https://github.com/TShreek/Agent-Guard18436/security/advisories/new) to report the vulnerability responsibly. This allows us to address the issue before it's publicly disclosed.

We appreciate your help in keeping Agent-Guard and its users safe!

## 💬 Community

Join our growing community of developers and users:

- [GitHub Discussions](https://github.com/TShreek/Agent-Guard18436/discussions) - Share ideas and ask questions
- [Security Issues](https://github.com/TShreek/Agent-Guard18436/issues?q=label%3Asecurity) - Track the security hardening roadmap

## 👏 Acknowledgments

Agent Guard builds on top of other awesome open-source projects:

- [Browser Use](https://github.com/browser-use/browser-use)
- [Puppeteer](https://github.com/EmergenceAI/Agent-E)
- [Chrome Extension Boilerplate](https://github.com/Jonghakseo/chrome-extension-boilerplate-react-vite)
- [LangChain](https://github.com/langchain-ai/langchainjs)

Huge thanks to their creators and contributors!

## 📄 License

This project is licensed under the Apache License 2.0 - see the [LICENSE](LICENSE) file for details.

Made with ❤️ by the Agent-Guard Team.

Like Agent-Guard? Give us a star 🌟 on [GitHub](https://github.com/TShreek/Agent-Guard18436)!

## ⚠️ DISCLAIMER ON DERIVATIVE PROJECTS

**We explicitly *DO NOT* endorse, support, or participate in any** projects involving cryptocurrencies, tokens, NFTs, or other blockchain-related applications **based on this codebase.**

**Any such derivative projects are NOT Affiliated with, or maintained by, or in any way connected to the official Agent Guard project or its core team.**

**We assume NO LIABILITY for any losses, damages, or issues arising from the use of third-party derivative projects. Users interact with these projects at their own risk.**

**We reserve the right to publicly distance ourselves from any misuse or misleading use of our name, codebase, or brand.**

We encourage open-source innovation but urge our community to be discerning and cautious. Please ensure you understand the risks before using any software or service built upon our codebase by independent developers.


