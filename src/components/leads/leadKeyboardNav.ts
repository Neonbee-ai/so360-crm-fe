/**
 * leadKeyboardNav.ts — keyboard-navigation core for the leads grid (Phase 5).
 *
 * Pure helpers so the (DOM-bound) grid keeps only wiring. `nextFocusIndex`
 * computes the next focused row for an arrow/Home/End key; `scrollToRevealIndex`
 * computes the scrollTop needed to keep that row inside the viewport (works with
 * the grid's fixed-height virtualization).
 */

/** Keys this module treats as row navigation. */
export const NAV_KEYS = new Set(['ArrowDown', 'ArrowUp', 'Home', 'End']);

/**
 * Compute the next focused row index for a navigation key.
 * - Returns null when `key` is not a navigation key, or when the list is empty.
 * - From "no focus" (current < 0), ArrowDown/ArrowUp/Home all land on row 0;
 *   End lands on the last row.
 * - Movement is clamped to [0, total-1].
 */
export function nextFocusIndex(current: number, key: string, total: number): number | null {
  if (total <= 0 || !NAV_KEYS.has(key)) return null;
  switch (key) {
    case 'ArrowDown':
      return current < 0 ? 0 : Math.min(total - 1, current + 1);
    case 'ArrowUp':
      return current <= 0 ? 0 : current - 1;
    case 'Home':
      return 0;
    case 'End':
      return total - 1;
    default:
      return null;
  }
}

/**
 * Compute the scrollTop that reveals `index` within the viewport, given fixed
 * `rowHeight`. Returns the current scrollTop unchanged when the row is already
 * fully visible; otherwise the minimal scroll to bring it into view (scroll up to
 * the row's top, or up-from-bottom so its bottom edge sits at the viewport edge).
 */
export function scrollToRevealIndex(
  index: number,
  rowHeight: number,
  scrollTop: number,
  viewportHeight: number,
): number {
  if (index < 0 || rowHeight <= 0 || viewportHeight <= 0) return scrollTop;
  const top = index * rowHeight;
  const bottom = top + rowHeight;
  if (top < scrollTop) return top;
  if (bottom > scrollTop + viewportHeight) return bottom - viewportHeight;
  return scrollTop;
}
