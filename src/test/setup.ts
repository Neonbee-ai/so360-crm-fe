import '@testing-library/jest-dom/vitest';

// jsdom's Range implementation is incomplete (no getBoundingClientRect /
// getClientRects), which ProseMirror (used by the Tiptap note editor)
// requires to compute cursor/selection positions. Polyfill both so the
// editor can mount and be interacted with under vitest.
document.createRange = () => {
  const range = new Range();
  range.getBoundingClientRect = () => ({
    x: 0, y: 0, width: 0, height: 0, top: 0, right: 0, bottom: 0, left: 0, toJSON: () => {},
  }) as DOMRect;
  range.getClientRects = () => ({
    item: () => null,
    length: 0,
    [Symbol.iterator]: function* () {},
  }) as unknown as DOMRectList;
  return range;
};
