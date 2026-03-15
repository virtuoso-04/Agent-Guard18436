# Development Guide

## Prerequisites

- **pnpm 9.15.1+** — required, no npm/yarn
- **Node >=22.12.0** — enforced via `engine-strict=true`
- Run `nvm use` before installing to match `.nvmrc`

---

## Daily Commands

```bash
# Install / after pulling
pnpm install

# Development with hot reload (concurrency: 20)
pnpm dev

# Production build
pnpm build

# Type checking (run before committing)
pnpm type-check

# Lint with auto-fix
pnpm lint

# Format
pnpm prettier

# Unit tests
pnpm -F chrome-extension test

# Targeted test
pnpm -F chrome-extension test -- -t "Sanitizer"

# Create ZIP for distribution
pnpm zip

# E2E tests (builds + zips first)
pnpm e2e
```

## Workspace-Scoped Commands (Preferred — Faster)

Scope to a single workspace when you only changed files there:

```bash
pnpm -F chrome-extension build
pnpm -F chrome-extension type-check
pnpm -F chrome-extension lint
pnpm -F chrome-extension prettier -- src/background/agent/executor.ts

pnpm -F pages/side-panel build
pnpm -F pages/side-panel type-check
pnpm -F pages/side-panel lint -- src/components/ChatInput.tsx

pnpm -F packages/storage type-check
pnpm -F packages/ui lint
```

## Cleaning

```bash
pnpm clean              # Everything (artifacts + node_modules)
pnpm clean:bundle       # Only dist/build outputs
pnpm clean:turbo        # Clear Turbo cache (use when caching goes wrong)
pnpm clean:node_modules # node_modules in current workspace only
pnpm clean:install      # clean:node_modules + reinstall
```

---

## Loading the Extension

1. Run `pnpm build` (or `pnpm dev` for watch mode)
2. Open `chrome://extensions/`
3. Enable **Developer mode**
4. Click **Load unpacked** → select `dist/`

For dev mode, the extension hot-reloads on file changes.

---

## Environment Variables

Use `.env.local` at the repo root (git-ignored). All variables must be prefixed with `VITE_`:

```bash
VITE_POSTHOG_API_KEY=phc_xxx
```

Vite in `chrome-extension/vite.config.mts` loads `VITE_*` from the parent directory.

Never commit secrets or API keys.

---

## Build System

**Turbo** orchestrates tasks across workspaces with dependency tracking and caching.

Task order:
1. `ready` — package preparation (i18n generation, etc.) — must complete first
2. `build` — Vite bundles each workspace independently
3. `zip` — packages `dist/` into `dist-zip/Agent Guard.zip`

Dev mode sets `__DEV__=true`. Use `import.meta.env.DEV` to gate debug code:
```typescript
if (import.meta.env.DEV) {
  logger.debug('...');
}
```

---

## Path Aliases

| Alias     | Resolves to             | Available in               |
|-----------|-------------------------|----------------------------|
| `@src`    | `src/`                  | All page workspaces, extension |
| `@root`   | repo root               | chrome-extension           |
| `@assets` | `src/assets/`           | chrome-extension           |

Page workspaces use `withPageConfig()` from `packages/vite-config` which sets up `@src`.

---

## TypeScript

- Strict mode enabled in all workspaces
- `@typescript-eslint/consistent-type-imports` enforced: use `import type` for type-only imports
- Shared base configs in `packages/tsconfig/` (`app.json`, `utils.json`)
- Each workspace extends the appropriate base

```typescript
// Correct
import type { AgentOptions } from './types';
import { AgentContext } from './types';

// Wrong
import { AgentOptions } from './types';  // type-only import not declared as type
```

---

## Code Style

- Prettier: 2 spaces, semicolons, single quotes, trailing commas, `printWidth: 120`
- React components: `PascalCase`
- Variables/functions: `camelCase`
- Workspace/package directories: `kebab-case`
- ESLint rules: React/Hooks/Import/A11y + TypeScript

---

## Adding New Features — Checklist

1. **New agent action**: Add Zod schema in `actions/schemas.ts` → register in `ActionBuilder.buildDefaultActions()` → add i18n keys in `packages/i18n/locales/en/messages.json`
2. **New storage field**: Add to appropriate type in `packages/storage/lib/settings/types.ts` → update the store's `get()`/`set()` methods → handle migration for existing users
3. **New UI component**: Check `packages/ui/lib/` first; if reusable put it there, else put in the page's `src/components/`
4. **New LLM provider**: Add to `ProviderTypeEnum` in `packages/storage/lib/settings/types.ts` → add factory case in `chrome-extension/src/background/agent/helper.ts` → add UI in `pages/options/src/components/ModelSettings.tsx`
5. **New port message type**: Handle in `background/index.ts` switch → add handler + i18n keys → update this doc
6. **New i18n key**: Edit `packages/i18n/locales/en/messages.json` (and other locales) → rebuild (`pnpm -F @agent-guard/i18n build`) → generated types update automatically

---

## Do Not Touch (Generated / Locked)

- `dist/**` — build output
- `build/**` — intermediate build artifacts
- `packages/i18n/lib/**` — generated from locale JSON
- `turbo.json` — ask before modifying
- `pnpm-workspace.yaml` — ask before modifying
- `tsconfig*` root-level files — ask before modifying

---

## Adding Dependencies

Always ask before adding a new dependency. When approved:

```bash
# Add to a specific workspace
pnpm -F chrome-extension add some-package
pnpm -F pages/side-panel add some-package --save-dev

# Add to root (shared tooling only)
pnpm add -w some-dev-tool --save-dev
```

---

## Git Workflow

- Keep diffs minimal and scoped — avoid mass reformatting unrelated files
- Run `pnpm type-check` and `pnpm lint` before committing
- The `.husky/` hooks run on commit

---

## Testing

Framework: **Vitest**

Test location: `chrome-extension/src/**/__tests__/*.test.ts`

Write fast, deterministic tests. Mock Chrome APIs and network calls.

```typescript
// Example test file location
chrome-extension/src/background/services/guardrails/__tests__/guardrails.test.ts
```

When adding business logic in the background, add a corresponding `__tests__/` file.
