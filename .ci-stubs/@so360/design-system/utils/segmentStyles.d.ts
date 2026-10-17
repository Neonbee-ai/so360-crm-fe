/**
 * Shared look for segmented tracks (SegmentedControl, ToggleGroup, pill Tabs): a muted sunken track,
 * a raised surface thumb with a 1px border and primary text. No saturated fill, no shadow.
 */
export declare const SEGMENT_TRACK = "rounded-nb border border-line bg-surface-sunken p-0.5";
export declare const SEGMENT_ON = "border border-line bg-surface-raised text-primary";
export declare const SEGMENT_OFF = "border border-transparent text-fg-muted enabled:hover:bg-fg/state-hover enabled:hover:text-fg enabled:active:bg-fg/state-pressed";
export declare const SEGMENT_FOCUS_OFFSET = "focus-visible:ring-offset-surface-sunken";
