# CVSS v3.1

This scheme models the Common Vulnerability Scoring System version 3.1, as
defined by [FIRST.org](https://www.first.org/cvss/v3.1/specification-document).
CVSS is the most widely used way to describe the severity of a software
vulnerability. A CVSS assessment is captured as a vector string such as
`CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H`, and this scheme parses, renders,
and validates that string.

It covers all three v3.1 metric groups: the required Base group plus the
optional Temporal and Environmental groups. Within the Environmental group it
models the Security Requirements (CR / IR / AR); see the note below.

## Metric groups

**Base** (required) describes the intrinsic characteristics of a vulnerability,
constant over time and across environments:

- Attack Vector (AV): N / A / L / P
- Attack Complexity (AC): L / H
- Privileges Required (PR): N / L / H
- User Interaction (UI): N / R
- Scope (S): U / C
- Confidentiality, Integrity, Availability impact (C / I / A): N / L / H

**Temporal** (optional) reflects how the threat changes over time:

- Exploit Code Maturity (E), Remediation Level (RL), Report Confidence (RC)

**Environmental** (optional) lets an organization adjust the score for its own
deployment:

- Security requirements (CR / IR / AR)

The Environmental Modified Base metrics (MAV, MAC, MPR, and the rest) are part of
the v3.1 spec but are not modeled by this scheme; only the Security Requirements
sub-metrics are encoded.

## Structure

- **Mode:** composition. A marking is the set of metrics present in the vector.
- **Categories:** one per metric (Base required, Temporal and Environmental
  optional), each single-select.
- **Rollup:** `max` per metric, so aggregating several vectors keeps the
  worst value seen for each metric.
- **Render format:** the canonical vector with the fixed `CVSS:3.1/` prefix.

The `CVSS:3.1` version prefix is rebuilt from the render prefix on every output.
On the parse side it is an unmatched token and is dropped, so a vector
roundtrips cleanly rather than echoing the prefix twice.

## Behavior

What this scheme does is stated as data, in the test suite
[`../../../scheme-folder/test-suites/cvss-tests@1.0.0.yaml`](../../../scheme-folder/test-suites/cvss-tests@1.0.0.yaml),
and checked by running it:

```bash
ezclassify scheme test ./scheme-folder/test-suites/cvss-tests@1.0.0.yaml
```

A few of the cases, in prose:

- A complete base vector round-trips byte for byte.
- A vector supplied out of order comes back in the order the specification
  fixes.
- Temporal metrics are optional, and a vector that carries them keeps them.
- A vector missing one of the eight base metrics is invalid. It still parses
  the metrics it carries, and the error names the metric that is absent.
- An undefined metric value, such as `AV:Z`, is refused.

Parsing is case insensitive, so lowercase metric values are normalized to the
canonical uppercase form.

## Further reading

- [`docs/sources.md`](docs/sources.md): primary and secondary sources.
- [`docs/use-cases.md`](docs/use-cases.md): actors and how they score and consume CVSS.
- [`docs/traceability.md`](docs/traceability.md): mapping from the v3.1 spec to this scheme.

For CVSS 4.0, see the [`cvss-v4`](../cvss-v4) scheme.

**Source:** [`../../../scheme-folder/schemes/cvss@3.1.0.yaml`](../../../scheme-folder/schemes/cvss@3.1.0.yaml) &middot; **License:** Apache-2.0
