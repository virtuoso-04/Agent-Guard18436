# Extending Agent Guard — Patterns & Recipes

This doc covers the concrete patterns to follow when building new capabilities on top of Agent Guard.

---

## Adding a New Browser Action

Actions are the atomic units of what the Navigator can do (click, type, navigate, etc.).

**Step 1 — Define the Zod schema** in `chrome-extension/src/background/agent/actions/schemas.ts`:

```typescript
export const MyActionSchema = z.object({
  intent: z.string().describe('Why this action is being taken'),
  target: z.string().describe('What to target'),
});
export type MyActionInput = z.infer<typeof MyActionSchema>;
```

**Step 2 — Register in `ActionBuilder`** in `chrome-extension/src/background/agent/actions/builder.ts`:

```typescript
{
  name: 'my_action',
  description: 'Does X to Y',
  schema: MyActionSchema,
  handler: async (params: MyActionInput): Promise<ActionResult> => {
    // implementation using this.context.browserContext
    return { success: true, includeInMemory: true, extractedContent: '...' };
  }
}
```

**Step 3 — Add i18n keys** in `packages/i18n/locales/en/messages.json`:

```json
"act_myAction_start": { "message": "Starting $THING$", "placeholders": { "thing": { "content": "$1" } } },
"act_myAction_ok": { "message": "Completed $THING$", "placeholders": { "thing": { "content": "$1" } } },
"act_myAction_fail": { "message": "Failed to $THING$: $ERROR$", "placeholders": { "thing": { "content": "$1" }, "error": { "content": "$2" } } }
```

**Step 4 — Emit events** inside the handler:

```typescript
this.context.emitEvent(Actors.NAVIGATOR, ExecutionState.ACT_START, t('act_myAction_start', [params.target]));
// ... do work ...
this.context.emitEvent(Actors.NAVIGATOR, ExecutionState.ACT_OK, t('act_myAction_ok', [params.target]));
```

---

## Adding a New Agent

To add a third specialized agent (e.g., a Validator or Extractor):

**Step 1 — Add to `AgentNameEnum`** in `packages/storage/lib/settings/types.ts`:

```typescript
enum AgentNameEnum {
  Navigator = 'navigator',
  Planner = 'planner',
  MyAgent = 'my_agent',   // new
}
```

**Step 2 — Create the agent class** in `chrome-extension/src/background/agent/agents/my_agent.ts`:

```typescript
import { BaseAgent } from './base';
import type { AgentOptions } from '../types';

export interface MyAgentOutput {
  result: string;
  done: boolean;
}

export class MyAgent extends BaseAgent<MyAgentOutputSchema, MyAgentOutput> {
  async execute(): Promise<AgentOutput<MyAgentOutput>> {
    // 1. add state to memory
    // 2. call LLM
    // 3. parse output
    // 4. emit events
    // 5. return result
  }
}
```

**Step 3 — Create a prompt** in `chrome-extension/src/background/agent/prompts/my_agent.ts`, extending `BasePrompt`.

**Step 4 — Wire into `Executor`**: instantiate in constructor, call in the execution loop.

**Step 5 — Add model selection to storage + options UI**: follow the pattern in `packages/storage/lib/settings/agentModels.ts` and `pages/options/src/components/ModelSettings.tsx`.

---

## Adding a New LLM Provider

**Step 1** — Add to `ProviderTypeEnum` in `packages/storage/lib/settings/types.ts`.

**Step 2** — Add a default config entry in `packages/storage/lib/settings/llmProviders.ts`.

**Step 3** — Add the LangChain factory case in `chrome-extension/src/background/agent/helper.ts`:

```typescript
case ProviderTypeEnum.MyProvider:
  return new ChatMyProvider({
    apiKey: providerConfig.apiKey,
    model: agentModel.modelName,
    temperature: agentModel.temperature,
  });
```

**Step 4** — Add the install dep: `pnpm -F chrome-extension add @langchain/my-provider`

**Step 5** — Add UI in `pages/options/src/components/ModelSettings.tsx` following existing provider patterns.

---

## Adding a New Port Message Type

**Step 1** — Handle in the switch in `chrome-extension/src/background/index.ts`:

```typescript
case 'my_message': {
  if (!message.requiredField)
    return port.postMessage({ type: 'error', error: t('bg_cmd_myMessage_missing') });
  // ... do work ...
  return port.postMessage({ type: 'success', result: ... });
}
```

**Step 2** — Send from SidePanel in `pages/side-panel/src/SidePanel.tsx`:

```typescript
portRef.current?.postMessage({ type: 'my_message', requiredField: value });
```

**Step 3** — Handle the response in the port `onmessage` handler in SidePanel.

**Step 4** — Add i18n keys for errors.

---

## Adding New Storage

**Step 1** — Define the type in `packages/storage/lib/settings/types.ts` or create a new file:

```typescript
export interface MyFeatureConfig {
  enabled: boolean;
  threshold: number;
}
```

**Step 2** — Create the store (following `generalSettings.ts` as a template):

```typescript
// packages/storage/lib/settings/myFeature.ts
import { BaseStorage, createStorage, StorageEnum } from '../base';

const myFeatureStorage = createStorage<MyFeatureConfig>(
  'my-feature-config',
  { enabled: false, threshold: 100 },
  { storageEnum: StorageEnum.Local, liveUpdate: true }
);

export const myFeatureStore = {
  getSettings: () => myFeatureStorage.get(),
  setSettings: (config: Partial<MyFeatureConfig>) => myFeatureStorage.set(...),
  subscribe: myFeatureStorage.subscribe,
  getSnapshot: myFeatureStorage.getSnapshot,
};
```

**Step 3** — Export from `packages/storage/lib/index.ts`.

**Step 4** — If the feature needs a settings UI, add a tab/section in `pages/options/src/Options.tsx` with a new component in `pages/options/src/components/`.

---

## Adding UI to the Side Panel

The side panel is `pages/side-panel/src/SidePanel.tsx` (~1200 lines). Key state:

```typescript
const [messages, setMessages] = useState<Message[]>([])
const [currentSessionId, setCurrentSessionId] = useState<string | null>(null)
const [isFollowUpMode, setIsFollowUpMode] = useState(false)
const [showHistory, setShowHistory] = useState(false)
```

For new panels/sections, create a component in `pages/side-panel/src/components/` and add the toggle in SidePanel.

For new input controls (buttons, toggles next to the chat input), extend `pages/side-panel/src/components/ChatInput.tsx`.

Use components from `packages/ui/lib/` (Button, etc.) and Tailwind tokens from `packages/tailwind-config` rather than custom styles.

---

## Modifying Agent Prompts

Prompts live in:
- `chrome-extension/src/background/agent/prompts/navigator.ts`
- `chrome-extension/src/background/agent/prompts/planner.ts`
- `chrome-extension/src/background/agent/prompts/templates/` — shared template strings

The Navigator system prompt is set once per task via `NavigatorPrompt.getSystemMessage()`.
The Planner is called with context at each planning step.

When modifying prompts, run the extension and test with several task types. Prompts significantly affect reliability.

---

## Firewall / URL Access Control

The firewall is applied at the BrowserContext level before each navigation:

```typescript
// From background/index.ts → setupExecutor()
browserContext.updateConfig({
  allowedUrls: firewall.allowList,
  deniedUrls: firewall.denyList,
});
```

`URLNotAllowedError` is thrown by BrowserContext and propagates up through the Executor — it's a non-retryable error (the task fails immediately).

To add new URL-based gating logic, extend `chrome-extension/src/background/browser/context.ts`.

---

## Analytics

Use the `analytics` singleton from `chrome-extension/src/background/services/analytics.ts`:

```typescript
import { analytics } from '../services/analytics';
analytics.trackTaskStart(taskId);
analytics.trackTaskComplete(taskId);
analytics.trackTaskFailed(taskId, errorCategory);
analytics.trackTaskCancelled(taskId);
```

For new custom events:
```typescript
analytics.capture('my_feature_used', { property: value });
```

Analytics respects `analyticsSettingsStore` — check if opt-in is required for your new event.

---

## Content Script Interactions

The content script (`pages/content/`) is injected into every `http://` page via `injectBuildDomTreeScripts()`.

Current responsibility: building the DOM element tree for the Navigator.

To send data from a web page to the background, use `chrome.runtime.sendMessage()` from content script.
To send from background to content script, use `chrome.tabs.sendMessage(tabId, ...)`.

Avoid adding heavy logic to the content script — it runs in page context and increases attack surface.

---

## Error Handling Patterns

Custom error types in `chrome-extension/src/background/agent/agents/errors.ts`:

| Error                       | Meaning                              | Behavior in Executor                 |
|-----------------------------|--------------------------------------|--------------------------------------|
| `ChatModelAuthError`        | Invalid API key                      | Task fails immediately (re-thrown)   |
| `ChatModelBadRequestError`  | Malformed request                    | Task fails immediately (re-thrown)   |
| `ChatModelForbiddenError`   | Account/quota issue                  | Task fails immediately (re-thrown)   |
| `URLNotAllowedError`        | Firewall blocked URL                 | Task fails immediately (re-thrown)   |
| `RequestCancelledError`     | User cancelled                       | Task cancelled cleanly               |
| `ExtensionConflictError`    | Chrome extension conflict            | Task fails immediately (re-thrown)   |
| `MaxStepsReachedError`      | Exceeded step limit                  | Task fails with message              |
| `MaxFailuresReachedError`   | Exceeded consecutive failure limit   | Task fails with message              |

For new non-retryable errors, add to `errors.ts` and include in the re-throw lists in `executor.ts`.

For retryable errors, increment `context.consecutiveFailures` — the executor retries up to `maxFailures`.

---

## Speech-to-Text Integration

The STT pipeline lives in `chrome-extension/src/background/services/speechToText.ts`.
It uses `llmProviderStore.getAllProviders()` to find a compatible provider with audio transcription support.

Adding a new STT provider: extend `SpeechToTextService.create()` with the new provider type.

---

## Testing Patterns

```typescript
// Vitest setup — mock Chrome APIs
vi.mock('webextension-polyfill', () => ({
  default: { storage: { local: { get: vi.fn(), set: vi.fn() } } }
}));

// Test guardrails
import { Sanitizer } from '../guardrails/sanitizer';
const sanitizer = new Sanitizer({ strictMode: true });
const result = sanitizer.sanitize(content);
expect(result.threats).toHaveLength(0);
```

Place tests in `__tests__/` subdirectory alongside the file under test.
