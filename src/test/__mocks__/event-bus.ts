// Stub for @so360/event-bus — vi.mock() in each test can still override these.
//
// It is a real (tiny) in-memory bus rather than no-ops: publish→subscribe is
// how cross-page reactions work (deleting a lead tells the dashboard to
// re-read its counts), and a no-op stub silently passes those tests whether
// the wiring exists or not.
type Handler = (payload: any) => void;

const handlers = new Map<string, Set<Handler>>();

export const eventBus = {
  publish: (topic: string, payload?: any) => {
    handlers.get(topic)?.forEach((h) => {
      try {
        h(payload);
      } catch {
        /* a throwing subscriber must not break the others */
      }
    });
  },
  subscribe: (topic: string, handler: Handler) => {
    const set = handlers.get(topic) ?? new Set<Handler>();
    set.add(handler);
    handlers.set(topic, set);
    return () => set.delete(handler);
  },
  clear: () => handlers.clear(),
  // Legacy aliases some callers still use.
  emit: (topic: string, payload?: any) => eventBus.publish(topic, payload),
  on: (topic: string, handler: Handler) => eventBus.subscribe(topic, handler),
  off: (topic: string, handler: Handler) => handlers.get(topic)?.delete(handler),
};
export const useEventBus = () => eventBus;
