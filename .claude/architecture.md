# Architecture Reference

## Monorepo Layout

```
Agent-Guard18436/
├── chrome-extension/          # Background service worker + multi-agent system
├── pages/
│   ├── side-panel/            # Main chat UI (React)
│   ├── options/               # Settings page (React)
│   └── content/               # Content script injected into web pages
├── packages/
│   ├── storage/               # @agent-guard/storage — Chrome storage abstraction
│   ├── i18n/                  # @agent-guard/i18n — Internationalization
│   ├── shared/                # @agent-guard/shared — HOCs, hooks, utility types
│   ├── ui/                    # @agent-guard/ui — Shared React components
│   ├── schema-utils/          # @agent-guard/schema-utils — Zod helpers
│   ├── vite-config/           # @agent-guard/vite-config — Shared Vite config
│   ├── tailwind-config/       # @agent-guard/tailwind-config — Shared Tailwind
│   ├── tsconfig/              # @agent-guard/tsconfig — TS config bases
│   ├── hmr/                   # @agent-guard/hmr — Hot module replacement
│   ├── dev-utils/             # @agent-guard/dev-utils — Manifest parser
│   └── zipper/                # @agent-guard/zipper — ZIP bundler
├── turbo.json                 # Build task graph
├── pnpm-workspace.yaml        # Workspace roots
└── package.json               # Root scripts
```

## Build Output (`dist/`)

```
dist/
├── background.iife.js         # Service worker
├── content/index.iife.js      # Content script
├── side-panel/index.html      # Side panel UI
├── options/index.html         # Options page
├── manifest.json              # Generated from manifest.js
└── icon-{32,128}.png
```

---

## Core Data Flow

### Task Execution

```
User types task (SidePanel)
  → port.postMessage({ type: 'new_task', task, tabId, taskId })
  → background/index.ts: setupExecutor()
      → reads llmProviderStore, agentModelStore, generalSettingsStore, firewallStore
      → creates Executor(task, taskId, browserContext, navigatorLLM, { plannerLLM })
  → executor.execute()
      ┌─ loop (up to maxSteps) ─────────────────────────────────────────────┐
      │  every planningInterval steps: PlannerAgent.execute()               │
      │    → emits PLANNER events → port → SidePanel                       │
      │    → if planner.done → break                                        │
      │  NavigatorAgent.execute()                                           │
      │    → buildDomTree (content script)                                  │
      │    → select action via LLM (Zod-validated)                          │
      │    → execute action (click/input/navigate/etc.)                     │
      │    → emits NAVIGATOR events → port → SidePanel                     │
      └─────────────────────────────────────────────────────────────────────┘
  → emits TASK_OK / TASK_FAIL / TASK_CANCEL
  → executor.cleanup() → browserContext.cleanup()
```

### Port Protocol (SidePanel ↔ Background)

**SidePanel → Background:**
| `type`           | Required fields                           |
|------------------|-------------------------------------------|
| `new_task`       | `task`, `tabId`, `taskId`                 |
| `follow_up_task` | `task`, `tabId`                           |
| `cancel_task`    | —                                         |
| `pause_task`     | —                                         |
| `resume_task`    | —                                         |
| `screenshot`     | `tabId`                                   |
| `speech_to_text` | `audio` (base64 data URL)                 |
| `replay`         | `tabId`, `taskId`, `historySessionId`     |
| `state`          | —                                         |
| `nohighlight`    | —                                         |
| `heartbeat`      | —                                         |

**Background → SidePanel:**
- `AgentEvent` objects (actor, state, data, timestamp, type)
- `{ type: 'heartbeat_ack' }`
- `{ type: 'success', ... }`
- `{ type: 'error', error: string }`
- `{ type: 'speech_to_text_result', text }`
- `{ type: 'speech_to_text_error', error }`

**Security:** Background validates `port.sender.url === SIDE_PANEL_URL` and `port.sender.id === chrome.runtime.id` — unauthorized ports are immediately disconnected.

---

## Agent System

### Agent Hierarchy

```
Executor
  ├── PlannerAgent  (runs every planningInterval steps)
  │     → PlannerPrompt → LLM → PlannerOutput { done, next_steps, final_answer }
  └── NavigatorAgent (runs every step)
        → NavigatorPrompt → LLM → NavigatorOutput (list of actions)
        → NavigatorActionRegistry.executeActions()
```

### AgentContext (shared state)

```typescript
class AgentContext {
  taskId: string
  browserContext: BrowserContext
  messageManager: MessageManager
  eventManager: EventManager
  options: AgentOptions         // maxSteps, planningInterval, maxActionsPerStep, etc.
  nSteps: number
  consecutiveFailures: number
  stopped: boolean
  paused: boolean
  finalAnswer: string | null
  actionResults: ActionResult[]
  history: AgentStepHistory
  stepInfo: { stepNumber, maxSteps }
}
```

### Default AgentOptions

```typescript
{
  maxSteps: 100,
  maxActionsPerStep: 10,
  maxFailures: 3,
  retryDelay: 10,           // ms
  maxInputTokens: 128_000,
  maxErrorLength: 400,
  useVision: false,
  useVisionForPlanner: true,
  planningInterval: 3,
  includeAttributes: ['title','type','name','role','aria-label',
                      'placeholder','value','alt','href','src']
}
```

### ExecutionState Event Lifecycle

```
task.start → (step.start → act.start → act.ok/act.fail → step.ok/step.fail)* → task.ok/task.fail/task.cancel/task.pause
```

### Actors

| Enum         | Value       | Meaning                  |
|--------------|-------------|--------------------------|
| `SYSTEM`     | `system`    | Executor lifecycle       |
| `USER`       | `user`      | User input               |
| `PLANNER`    | `planner`   | PlannerAgent output      |
| `NAVIGATOR`  | `navigator` | NavigatorAgent output    |

---

## Action System

Actions are Zod-validated objects that the Navigator selects.

### Built-in Actions

| Action              | Description                          |
|---------------------|--------------------------------------|
| `go_to_url`         | Navigate to URL                      |
| `go_back`           | Browser back                         |
| `search_google`     | Google search                        |
| `click_element`     | Click by element index               |
| `input_text`        | Type text into input                 |
| `scroll_element`    | Scroll by index or direction         |
| `switch_tab`        | Switch to tab by ID                  |
| `open_tab`          | Open new tab                         |
| `close_tab`         | Close tab by ID                      |
| `extract_text`      | Extract page text content            |
| `get_page_state`    | Capture full page state              |
| `done`              | Signal task completion               |

Actions are built in `chrome-extension/src/background/agent/actions/builder.ts`.
To add a new action: define schema in `actions/schemas.ts`, register in `ActionBuilder.buildDefaultActions()`.

---

## Storage Layer (`packages/storage/`)

All stores implement `BaseStorage<T>` with `get()`, `set()`, `subscribe()`, `getSnapshot()`.

### Stores

| Store                   | Key data                                      |
|-------------------------|-----------------------------------------------|
| `agentModelStore`       | `{ [AgentNameEnum]: { provider, model, ... }}` |
| `llmProviderStore`      | `{ [providerId]: { type, apiKey, baseUrl, ... }}` |
| `generalSettingsStore`  | maxSteps, maxFailures, planningInterval, useVision, displayHighlights, minWaitPageLoad, replayHistoricalTasks |
| `chatHistoryStore`      | Sessions + messages, agent step history       |
| `favoritesStorage`      | Quick-access prompts                          |
| `firewallStore`         | enabled, allowList[], denyList[]              |
| `speechToTextStore`     | STT provider settings                         |
| `analyticsSettingsStore`| Data collection preferences                  |

### AgentNameEnum

```typescript
enum AgentNameEnum {
  Navigator = 'navigator',
  Planner = 'planner',
}
```

### ProviderTypeEnum

```typescript
enum ProviderTypeEnum {
  OpenAI, Anthropic, DeepSeek, Gemini, Grok,
  Ollama, AzureOpenAI, OpenRouter, Groq,
  Cerebras, Llama, CustomOpenAI
}
```

---

## DOM Subsystem (`chrome-extension/src/background/browser/dom/`)

The Navigator captures live DOM state through a content-script-injected tree builder.

- `DOMElementNode` — hierarchical node with visibility, viewport, shadow DOM, child list
- `DOMTextNode` — leaf text nodes
- `DOMHistoryElement` — snapshot of a node at interaction time (XPath, coordinates, viewport state)
- `HistoryTreeProcessor` — tracks DOM state across steps for replay
- `clickable/service.ts` — detects interactive elements, assigns indices used in actions

### DOM State to Agent

`BrowserContext.getState()` → returns `BrowserState { elementTree, url, title, screenshot? }`.
The element tree's `clickableElementsToString(includeAttributes)` produces the text representation fed to the Navigator LLM.

---

## Security Subsystem (`chrome-extension/src/background/services/guardrails/`)

Sanitizes LLM-visible content before it enters the message context.

Threat types detected:
- `TASK_OVERRIDE` — hidden characters or instructions attempting to hijack task
- `SENSITIVE_DATA` — credentials, tokens, PII in page content
- `XSS_ATTEMPT` — script injection patterns
- Empty/malformed tags

Tests: `chrome-extension/src/background/services/guardrails/__tests__/guardrails.test.ts`

---

## i18n System (`packages/i18n/`)

Source: `packages/i18n/locales/en/messages.json` (and pt_BR, zh_TW).
Generated types: `packages/i18n/lib/` — **do not edit**.

Key naming: `{prefix}_{component}_{action}_{state}`
- Prefixes: `bg_`, `exec_`, `act_`, `errors_`, `options_`, `chat_`, `nav_`, `permissions_`
- States: `_start`, `_ok`, `_fail`, `_cancel`, `_pause`

```typescript
import { t } from '@agent-guard/i18n';
t('act_click_ok')
t('act_goToUrl_start', ['https://example.com'])
```

---

## Key Path Reference

| What                              | Where                                                                  |
|-----------------------------------|------------------------------------------------------------------------|
| Service worker entry              | `chrome-extension/src/background/index.ts`                             |
| Executor                          | `chrome-extension/src/background/agent/executor.ts`                    |
| Navigator agent                   | `chrome-extension/src/background/agent/agents/navigator.ts`            |
| Planner agent                     | `chrome-extension/src/background/agent/agents/planner.ts`              |
| Agent context & types             | `chrome-extension/src/background/agent/types.ts`                       |
| Action schemas                    | `chrome-extension/src/background/agent/actions/schemas.ts`             |
| Action builder                    | `chrome-extension/src/background/agent/actions/builder.ts`             |
| Navigator prompt                  | `chrome-extension/src/background/agent/prompts/navigator.ts`           |
| Planner prompt                    | `chrome-extension/src/background/agent/prompts/planner.ts`             |
| Event types                       | `chrome-extension/src/background/agent/event/types.ts`                 |
| Event manager                     | `chrome-extension/src/background/agent/event/manager.ts`               |
| Message manager                   | `chrome-extension/src/background/agent/messages/service.ts`            |
| Browser context                   | `chrome-extension/src/background/browser/context.ts`                   |
| DOM tree builder                  | `chrome-extension/src/background/browser/dom/service.ts`               |
| DOM node types                    | `chrome-extension/src/background/browser/dom/views.ts`                 |
| Guardrails                        | `chrome-extension/src/background/services/guardrails/`                 |
| LLM model factory                 | `chrome-extension/src/background/agent/helper.ts`                      |
| Storage types & provider enums    | `packages/storage/lib/settings/types.ts`                               |
| Storage stores                    | `packages/storage/lib/settings/` + `packages/storage/lib/chat/`        |
| Side panel main component         | `pages/side-panel/src/SidePanel.tsx`                                   |
| Options page                      | `pages/options/src/Options.tsx`                                         |
| i18n locale source                | `packages/i18n/locales/en/messages.json`                               |
| Shared UI components              | `packages/ui/lib/`                                                      |
| Chrome manifest source            | `chrome-extension/manifest.js`                                          |
