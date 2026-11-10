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

## Crosswalks

Two crosswalks connect this scheme with [`cvss-v4`](../cvss-v4). Each one runs
in a single direction.

[`cvss-31-to-40`](../../../scheme-folder/crosswalks/cvss-31-to-40@1.0.0.yaml)
is a migration aid from 3.1 to 4.0, and it is partial on purpose. EzClassify
community content maintains it from the CVSS 4.0 specification and FIRST's
summary of what changed. It is not an official FIRST crosswalk.

- **Carries** Attack Vector, Privileges Required, Low Attack Complexity, no User
  Interaction, and Proof-of-Concept Exploit Code Maturity. 4.0 keeps these
  values as they are.
- **Sends to review** High Attack Complexity, which 4.0 splits into Attack
  Complexity and Attack Requirements; Required User Interaction, proposed as
  Passive or Active; Scope and the three impact metrics, because 4.0 scores
  vulnerable-system and subsequent-system impact separately; the other Exploit
  Code Maturity values; and the Security Requirements.
- **Omits** Not Defined Exploit Code Maturity, Remediation Level, and Report
  Confidence. 4.0 retires the last two.

Every 3.1 value gets one of those decisions, so nothing comes back unmapped.
The result is still never a complete 4.0 vector: Attack Requirements and the
six impact metrics have to come from an analyst. Keep the 3.1 vector and finish
the review before scoring. The suite
[`cvss-31-to-40-tests@1.0.0.yaml`](../../../scheme-folder/test-suites/cvss-31-to-40-tests@1.0.0.yaml)
states the behavior.

`cvss-40-to-31` goes the other way and derives a complete 3.1 Base vector. See
the [`cvss-v4` README](../cvss-v4/README.md#crosswalks).

## Further reading

- [`docs/sources.md`](docs/sources.md): primary and secondary sources.
- [`docs/use-cases.md`](docs/use-cases.md): actors and how they score and consume CVSS.
- [`docs/traceability.md`](docs/traceability.md): mapping from the v3.1 spec to this scheme.

For CVSS 4.0, see the [`cvss-v4`](../cvss-v4) scheme.

**Source:** [`../../../scheme-folder/schemes/cvss@3.1.0.yaml`](../../../scheme-folder/schemes/cvss@3.1.0.yaml) &middot; **License:** Apache-2.0
