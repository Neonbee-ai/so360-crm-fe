import '@testing-library/jest-dom/vitest';
import { beforeEach } from 'vitest';

// List pages persist their filters / sort / paging in sessionStorage so a trip
// to a detail page and back keeps the view (see useListViewState). Tests in a
// file share one jsdom, so without this every spec would inherit whatever the
// previous one filtered by.
beforeEach(() => {
  sessionStorage.clear();
});

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

// jsdom doesn't implement elementFromPoint, which ProseMirror calls on
// mousedown to resolve a document position — without this it throws an
// uncaught async TypeError that can corrupt unrelated tests sharing the
// same worker.
document.elementFromPoint = () => null;
