# 0003. Icon affordance on the freetext contact option

- Date: 2026-04-18
- Status: Accepted
- Scope: Metadata editor UI (D17)

## Context

The Contact tab of the metadata editor offers two input modes: a structured set of format-validated fields (address, phone, email) and a freetext fallback for writers whose contact information doesn't fit the structured shape (non-US address formats, shared contact blocks, agents' addresses with attention lines, and similar). The two modes are presented as a choice at the top of the Contact tab.

On-device review found the freetext option reading as secondary or de-emphasized next to the structured option, even though the two are equal peers by intent. Writers who wanted the freetext path were occasionally tapping the structured path first, then backing out. The label alone — "Freetext" or similar — did not carry enough weight to signal "this is a legitimate first-class choice."

## Decision

Add a Feather icon alongside the label on the freetext option. The icon sits to the left of the label, sized to match the structured-option icon, using the same token color in both modes. The presence of an icon on both options communicates that they are peer choices rather than primary-plus-fallback.

The specific Feather glyph chosen reads as "free-form text" rather than "file" or "document" to avoid confusion with the import screen's file-picker affordance.

## Consequences

- Freetext option reads as a first-class peer of the structured option. Verified on device that the mis-tap pattern observed during review does not reproduce.
- Any Play Store screenshot that includes the Contact tab with the option selector visible is stale relative to this decision.
- Adds one more icon reference; the Feather-icons dependency was already in the tree for other UI so no new dependency cost.

## Alternatives considered

- **Bold the freetext label instead of adding an icon.** Rejected: the structured option didn't have a bolded label, so bolding would have reversed the perceived hierarchy rather than balanced it.
- **Remove the icon from the structured option so both sit iconless.** Rejected: the structured-option icon was doing useful work beyond this comparison; removing it would have degraded the structured path to solve a problem on the freetext side.
- **Reorder so freetext sits first.** Rejected: the structured path is genuinely the more common choice; reordering would lead the majority of users away from the path they wanted.