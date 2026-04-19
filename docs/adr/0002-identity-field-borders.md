# 0002. Identity-field borders in the metadata editor

- Date: 2026-04-18
- Status: Accepted
- Scope: Metadata editor UI (D16)

## Context

The Identity tab of the metadata editor presents three text inputs — author name, legal name, and byline. The initial implementation wrapped each input in a card-style container with a visible border on all four sides. On-device review showed the borders reading as "form chrome" rather than as field edges, giving the screen a dense, administrative feel that didn't match the rest of the app's lighter treatment.

Identity data is short, one-line, and rarely re-entered once set; the fields don't need heavy framing to communicate what they are.

## Decision

Drop the full-border treatment on identity fields. Each field now sits on the container surface with a single underline below the input line, sized and colored to match the divider token used elsewhere in the app. Labels remain in their existing position above the input. Focus state is indicated by a weight change on the underline rather than by a full border swap.

This change applies to Identity-tab fields specifically. Contact-tab structured fields continue to use their own treatment (see ADR 0003 for the related freetext icon decision).

## Consequences

- Identity screen reads lighter and more consistent with Library and Detail surfaces.
- Any Play Store screenshot that includes the Identity tab will show a visible delta from current UI, though the change is subtle enough that screenshots may remain acceptable without recapture. Judge at listing-refresh time.
- Focus indication is less prominent than before. Verified on device that the underline weight change is still discoverable; if accessibility testing surfaces a contrast issue, revisit with an alternative focus token.

## Alternatives considered

- **Keep full borders but lighten the stroke color.** Rejected: still reads as form chrome, just fainter.
- **Drop borders entirely with no underline.** Rejected: loses the visual anchor for where input begins and ends, particularly when a field is empty.
- **Use a filled background instead of an underline.** Rejected: would clash with the card treatment used elsewhere and add weight we were trying to remove.