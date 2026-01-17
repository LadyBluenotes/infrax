---
id: rule:testing
targets: [cursor, copilot, claude]
selectors:
  contexts: [context:node-typescript]
---

## Testing Requirements

- Always add/update tests for behavior changes when tests exist
- Use the existing test framework in the project
- Write descriptive test names that explain the expected behavior
- Ensure tests are deterministic (no flaky tests)
- Run `pnpm test` before completing any task
