---
name: vue-pinia-best-practices
description: "Pinia stores, state management patterns, store setup, and reactivity with stores."
version: 1.0.0
license: MIT
author: github.com/vuejs-ai
---

Pinia best practices, common gotchas, and state management patterns.

### Store Setup
- Getting "getActivePinia was called" error at startup → See [pinia-no-active-pinia-error](references/pinia-no-active-pinia-error.md)
- Setup stores missing state in DevTools or SSR → See [pinia-setup-store-return-all-state](references/pinia-setup-store-return-all-state.md)

### Reactivity
- Store destructuring stops updating UI reactively → See [pinia-store-destructuring-breaks-reactivity](references/pinia-store-destructuring-breaks-reactivity.md)
- Store methods lose context in template calls → See [store-method-binding-parentheses](references/store-method-binding-parentheses.md)

### State Patterns
- Filters reset on refresh or can't be shared → See [state-url-for-ephemeral-filters](references/state-url-for-ephemeral-filters.md)
- Building production app without DevTools or conventions → See [state-use-pinia-for-large-apps](references/state-use-pinia-for-large-apps.md)
