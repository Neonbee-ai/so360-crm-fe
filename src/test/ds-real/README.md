# ds-real (test-only snapshot)

Verbatim copy of the design-system components that a few CRM tests render for
real (Modal, PeopleSelector, Sparkline, TrendIndicator, StatusLegend) plus
their relative imports. Source: so360-shell-fe `packages/design-system/src` at
develop be999b2.

Vitest maps `@ds-real` here. It used to point at a sibling
`../../so360-shell-fe` checkout, which does not exist on CI runners, so every
test file importing the design-system stub never finished collecting and the
Tests step hit its 900s timeout. Keep this folder self-contained; refresh it by
re-copying from the shell repo when those components change.
