# 0001. Metadata editor segmented-control active state

- Date: 2026-04-18
- Status: Accepted
- Scope: Metadata editor UI (D15)

## Context

The metadata editor presents two tabs — Identity and Contact — via a segmented control at the top of the screen. The initial implementation used the default Expo/React Native segmented treatment, which relies on a subtle text-weight shift and a thin underline indicator to mark the active segment. During on-device review on the S25 Ultra, the active segment was not immediately legible: at glance the screen read as "both tabs equally inactive," which forced a second look to confirm which tab was in focus.

The editor is a destination the user hits repeatedly across a session — every save-and-return cycle lands them back on it. Legibility at glance matters more here than in once-visited screens.

## Decision

Raise the visual weight of the active segment in the metadata editor's segmented control. The active segment now renders with a filled background drawn from the theme's accent token, with the inactive segment sitting flat against the container surface. Inactive-to-active transitions keep the existing hit-target geometry; only the rendered fill and text color change.

The decision is scoped to the metadata editor specifically; other screens that use segmented or tab-like controls are not in scope and are free to diverge if their context calls for a lighter treatment.

## Consequences

- Active-tab identification is one-glance rather than two-glance. Verified on device across both light and dark appearance modes.
- Any Play Store screenshot that includes the metadata editor is stale relative to this decision and must be recaptured before the next listing refresh.
- The filled treatment consumes the accent token on this screen; if a future design pass introduces another element here that also wants accent, the two will compete and one should yield.

## Alternatives considered

- **Keep the default underline + weight treatment.** Rejected: the on-device legibility finding was the whole prompt for revisiting it.
- **Switch to a pill-shaped iOS-style segmented control.** Rejected on grounds of platform fit — Android is the primary target and a pill segmented control reads as iOS-idiomatic.
- **Add a colored left-border indicator on the active segment instead of filling it.** Rejected as a halfway measure; the indicator adds visual noise without cleanly solving the glance-legibility problem.