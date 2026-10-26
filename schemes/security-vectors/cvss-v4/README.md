# CVSS v4.0

This scheme models the Common Vulnerability Scoring System version 4.0,
released in November 2023 by
[FIRST.org](https://www.first.org/cvss/v4.0/specification-document). It
supersedes CVSS v3.1. An assessment is captured as a vector string such as
`CVSS:4.0/AV:N/AC:L/AT:N/PR:N/UI:N/VC:H/VI:H/VA:H/SC:N/SI:N/SA:N`, and this
scheme parses, renders, and validates that string.

It models metrics from all four v4.0 groups: Base, Threat, Environmental,
and Supplemental.

## What changed from v3.1

- **Attack Requirements (AT)** is a new Base metric, carrying conditions that
  v3.1 folded into Attack Complexity.
- **Impact is split by system.** Vulnerable System (VC / VI / VA) and
  Subsequent System (SC / SI / SA) metrics replace the single Scope metric.
- **Threat** replaces Temporal, and reduces to one metric, Exploit Maturity (E).
- **Supplemental** is new: informational metrics that carry no score.
- **Scoring nomenclature** names the groups an assessment used: CVSS-B, CVSS-BT,
  CVSS-BE, CVSS-BTE.

## Metric groups

**Base** (required, all eleven metrics):

- Attack Vector (AV): N / A / L / P
- Attack Complexity (AC): L / H
- Attack Requirements (AT): N / P
- Privileges Required (PR): N / L / H
- User Interaction (UI): N / P / A
- Vulnerable System impact (VC / VI / VA): H / L / N
- Subsequent System impact (SC / SI / SA): H / L / N

**Threat** (optional): Exploit Maturity (E): X / A / P / U

**Environmental** (optional, deployment-specific overrides, `X` for not
defined):

- Security Requirements: CR / IR / AR, each X / H / M / L
- Modified Base metrics: MAV, MAC, MAT, MPR, MUI, MVC, MVI, MVA, MSC, MSI, MSA.
  Each mirrors its Base value set plus `X`. Modified Subsequent System Integrity
  (MSI) and Availability (MSA) additionally accept the Safety (S) value, which
  is not valid on any Base impact metric.

**Supplemental** (optional, informational, no score impact): Safety (S),
Automatable (AU), Recovery (R), Value Density (V), Response Effort (RE),
Provider Urgency (U).

Every optional metric accepts explicit `X` (Not Defined), including Threat
and Supplemental metrics. Omitted optional metrics remain omitted; FIRST treats
them as Not Defined for scoring. Explicit `X` values round-trip as supplied.

## Structure

- **Mode:** composition. A marking is the set of metrics present in the vector.
- **Categories:** one per metric, each single-select. The eleven Base metrics are
  required; every other group is optional.
- **Rollup:** `max` per metric, using the scheme's declared ranks. An explicit
  Not Defined value takes priority over evaluated values, as for Environmental
  metrics. This is the scheme's aggregation policy; FIRST does not define a
  method for aggregating vectors, and this operation does not calculate a score.
- **Render formats:** `default`, the canonical vector with the fixed `CVSS:4.0/`
  prefix; `metric`, the bare values without their metric abbreviations; and
  `severity`, the qualitative rating on its own.

The scheme also carries the five qualitative severity ratings (None, Low,
Medium, High, Critical) as their own category. A caller supplies the rating from an external CVSS
score calculation; this scheme does not calculate scores or infer ratings from
vector metrics. Vector-shaped formats leave the rating out, and the `severity`
format renders it by itself.

## Behavior

What this scheme does is stated as data, in the test suite
[`../../../scheme-folder/test-suites/cvss-v4-tests@1.0.1.yaml`](../../../scheme-folder/test-suites/cvss-v4-tests@1.0.1.yaml),
and checked by running it:

```bash
ezclassify scheme test ./scheme-folder/test-suites/cvss-v4-tests@1.0.1.yaml
```

A few of the cases, in prose:

- A complete Base vector round-trips byte for byte.
- A vector supplied out of order comes back in the order the specification
  fixes.
- A vector missing one of the eleven Base metrics is invalid, and the error
  names the metric that is absent.
- Threat and Supplemental metrics are optional, and a vector that carries them
  keeps them.
- An undefined metric value, such as `AT:Z`, is refused.
- A lowercase vector normalizes to the canonical uppercase form, and the
  correction is recorded rather than silently applied.

## Further reading

- [`docs/sources.md`](docs/sources.md): primary and secondary sources.
- [`docs/use-cases.md`](docs/use-cases.md): actors and how they score and consume CVSS.
- [`docs/traceability.md`](docs/traceability.md): mapping from the v4.0 spec to this scheme.
- [`docs/first-org-cvss-v4.md`](docs/first-org-cvss-v4.md): our summary of the FIRST.org v4.0 specification and how this scheme reads it.

For CVSS 3.1, see the [`cvss`](../cvss) scheme.

**Source:** [`../../../scheme-folder/schemes/cvss-v4@4.0.0.yaml`](../../../scheme-folder/schemes/cvss-v4@4.0.0.yaml) &middot; **License:** Apache-2.0
