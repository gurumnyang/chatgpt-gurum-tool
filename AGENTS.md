# Repository Guidelines

## Project Structure & Module Organization
- Browser code lives at the root: `background.js`, `content.js`, `popup.js`, `popup.html`, and manifest files orchestrate the extension lifecycle.
- Token tools are bundled from `src/tiktoken-wrapper.js` into `dist/` via Webpack; web-facing helpers sit in `token-calculator.js`, `timestamp-injector.js`, and `fetch-hook.js`.
- UI assets (icons, popup themes) reside in `icons/`, `thirdParty/`, and `_locales/` for translations; usage limit data ships from `config/plan-limits.json`.
- Release bundles and third-party artifacts are generated; avoid editing compiled `dist/` files by hand.

## Build, Test, and Development Commands
- `npm install` — install node dependencies before any build.
- `npm run build` — produce development bundles (`dist/tiktoken*.bundle.js`).
- `npm run watch` — rebuild bundles on source changes for faster iteration.
- `npm run build:release` / `npm run build:firefox` — generate packed artifacts for Chrome or Firefox store uploads.
- `npm run lint` / `npm run lint:fix` — verify or auto-fix style issues with ESLint + Prettier.

## Coding Style & Naming Conventions
- JavaScript follows ESLint + Prettier defaults (2-space indentation, semicolons, single quotes unless escaping is awkward).
- Keep filenames lowercase with hyphens (`token-calculator.js`); manifest keys remain camelCase to match Chrome APIs.
- Prefer concise function names that reflect scope (`refreshPlanLimitsFromRemote`, `injectTimestampInjector`).
- Add comments sparingly for non-obvious DOM or storage interactions.

## Testing Guidelines
- No automated test suite is present (`npm test` exits immediately); rely on manual verification in Chrome/Firefox.
- When adding tests, colocate them under `__tests__/` or alongside modules with `.spec.js` suffix and document the runner in `package.json`.
- Validate new features by loading the unpacked extension and exercising API hooks, popup UI, and background sync flows.

## Commit & Pull Request Guidelines
- Recent history shows short, descriptive subjects in Korean or English (e.g., `fix:최초설치시 타임스탬프 오표기 이슈 해결`, `Prettier: 코드 리팩토링`). Keep titles under 72 characters and focus on the primary change.
- Use prefixes like `fix:`, `feat:`, or tool names (`Prettier:`) when it improves scanning.
- Detail testing steps, screenshots of UI adjustments, and any manifest permission changes in PR descriptions. Link issues when applicable and note follow-up tasks.
- Before opening a PR, run `npm run build` and `npm run lint` so reviewers can focus on behavior instead of formatting.

## Security & Configuration Tips
- Treat `config/plan-limits.json` as canonical; background sync fetches the GitHub version, so avoid bundling credentials or secrets.
- Limit host permission changes to the ChatGPT domains unless a feature requires more; document any new remote endpoints in the PR.
- For QA, load the unpacked extension and clear `chrome.storage.local` between runs to avoid stale usage counters.
