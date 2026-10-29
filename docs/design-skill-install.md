# Design skill provenance and execution

Installed project-local using `npx --yes skills add JimLiu/baoyu-design --agent codex --skill baoyu-design -y`. The skill resides under ignored .agents/skills, with source tracking in skills-lock.json. No global skills were changed.

Read the repository README, SKILL.md, system-prompt.md, Codex reference, hi-fi-design, interactive-prototype and design-system-authoring-guide. Also inspected the repository's claude-design-system and claude-dashboard offerings; the baoyu-design authoring/compiler workflow was sufficient for the requested application artifacts, so unrelated artifact editors were not installed.

Executed record-asset.mjs for all module HTML artifacts, compile-design-system.mjs, check-design-system.mjs and build-preview.mjs. The selected Foundry visual system was translated into React/Radix components and shared CSS tokens. Browser previews ran through Ego; production flow QA uses Playwright.

Compatibility fix: this monorepo is ESM, but the skill's vendored Babel is a UMD/CommonJS file. A project-local agents/vendor/package.json with type=commonjs lets the documented compiler load the existing vendored file. No skill source or global configuration changed. The final compiler discovers 2 design components, 1 foundation card and 17 tokens; checker reports no issues. The design artifact component library is intentionally smaller than the production React component set.

The user explicitly asked for autonomous choices, so no design approval was requested and no human approval is recorded. Foundry/Precision/Studio evaluations are design judgments, not user-study measurements.
