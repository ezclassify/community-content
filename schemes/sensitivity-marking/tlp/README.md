# Traffic Light Protocol (TLP)

This scheme models the Traffic Light Protocol version 2.0, published by
[FIRST.org](https://www.first.org/tlp/). TLP is a small, widely adopted set of
labels that tell a recipient how far they may pass a piece of information on. It
is used across cybersecurity intelligence and incident response, where the same
report often moves between vendors, sector ISACs, CERTs, and government teams.

TLP is not a classification scheme and carries no legal force. It is a sharing
convention: the originator picks a label, and recipients are expected to honor
the boundary that label sets.

## The five levels

Each marking is a single label drawn from one axis. The labels are ordered from
the most open to the most restricted:

| Marking            | Who you may share with                                            |
|--------------------|------------------------------------------------------------------|
| `TLP:CLEAR`        | Anyone. No restriction on disclosure.                            |
| `TLP:GREEN`        | Your community and partner organizations, but not in public.    |
| `TLP:AMBER`        | Your own organization and its clients, on a need-to-know basis. |
| `TLP:AMBER+STRICT` | Your own organization only, on a need-to-know basis.            |
| `TLP:RED`          | The named recipients only. No onward sharing at all.            |

`TLP:CLEAR` replaces the older `TLP:WHITE` from TLP v1. The scheme accepts
`WHITE` and `TLP:WHITE` as aliases so legacy markings still resolve.

## Structure

- **Mode:** taxonomy. One marking carries exactly one level.
- **Category:** `tlp_level` (required, single-select).
- **Rollup:** `max`. Aggregating several markings keeps the most restrictive
  level, so a bundle marked `TLP:GREEN` and `TLP:RED` rolls up to `TLP:RED`.
- **Render formats:** `default` (`TLP:RED`) and `short` (`RED`).

## Behavior

What this scheme does is stated as data, in the test suite
[`../../../scheme-folder/test-suites/tlp-tests@1.0.0.yaml`](../../../scheme-folder/test-suites/tlp-tests@1.0.0.yaml),
and checked by running it:

```bash
ezclassify scheme test ./scheme-folder/test-suites/tlp-tests@1.0.0.yaml
```

A few of the cases, in prose:

- `TLP:RED` round-trips unchanged.
- `tlp:amber+strict` normalizes to `TLP:AMBER+STRICT`. Parsing is case
  insensitive and tolerates `/`, `,`, or whitespace separators, so analyst
  shorthand like `tlp:red` resolves to the canonical `TLP:RED`.
- `TLP:WHITE`, retired in v2.0, resolves to `TLP:CLEAR`.
- `TLP:RED` renders as `RED` in the `short` format.
- `TLP:GREEN` aggregated with `TLP:RED` rolls up to `TLP:RED`.
- Two levels at once is refused: a document carries one TLP level.

## Further reading

- [`docs/sources.md`](docs/sources.md): primary and secondary sources.
- [`docs/use-cases.md`](docs/use-cases.md): actors and how they apply TLP.
- [`docs/traceability.md`](docs/traceability.md): mapping from the spec to this scheme.
- [`docs/first-org-tlp-v2.md`](docs/first-org-tlp-v2.md): our summary of the FIRST.org v2.0 standard and how this scheme reads it.

**Source:** [`../../../scheme-folder/schemes/tlp@2.0.0.yaml`](../../../scheme-folder/schemes/tlp@2.0.0.yaml) &middot; **License:** Apache-2.0
