// Stub for @so360/event-bus — vi.mock() in each test overrides these.
// Mirrors the real package surface (publish/subscribe/clear) plus the legacy
// emit/on/off helpers some callers still use.
export const eventBus = {
  publish: () => {},
  subscribe: () => () => {},
  clear: () => {},
  emit: () => {},
  on: () => () => {},
  off: () => {},
};
export const useEventBus = () => eventBus;
