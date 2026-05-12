// Stub for @so360/event-bus — vi.mock() in each test overrides these
export const eventBus = {
  emit: () => {},
  on: () => () => {},
  off: () => {},
};
export const useEventBus = () => eventBus;
