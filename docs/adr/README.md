# Architecture Decision Records

This directory holds design-decision records for ManuscriptReady. Each record captures a single decision, the context that prompted it, and the consequences of the chosen path.

## Format

ADRs follow a lightweight [Michael Nygard format](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions). Each file uses this structure:

```
# NNNN. Title

- Date: YYYY-MM-DD
- Status: Accepted | Superseded by NNNN | Deprecated
- Scope: <feature area>

## Context
## Decision
## Consequences
## Alternatives considered
```

Numbering is sequential. A decision is immutable once accepted; if the direction changes, add a new ADR that supersedes the old one rather than editing history.

## Index

| # | Title | Status |
|---|---|---|
| [0001](./0001-metadata-segmented-control-active-state.md) | Metadata editor segmented-control active state | Accepted |
| [0002](./0002-identity-field-borders.md) | Identity-field borders in the metadata editor | Accepted |
| [0003](./0003-contact-tab-freetext-icon.md) | Icon affordance on the freetext contact option | Accepted |