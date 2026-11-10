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
[`../../../scheme-folder/test-suites/cvss-v4-tests@1.0.0.yaml`](../../../scheme-folder/test-suites/cvss-v4-tests@1.0.0.yaml),
and checked by running it:

```bash
ezclassify scheme test ./scheme-folder/test-suites/cvss-v4-tests@1.0.0.yaml
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

## Crosswalks

[`cvss-40-to-31`](../../../scheme-folder/crosswalks/cvss-40-to-31@1.0.0.yaml)
derives a CVSS 3.1 vector from a 4.0 vector using the conversion rubric FIRST
publishes in its
[CVSS FAQ](https://www.first.org/cvss/faq#How-can-CVSS-v31-vectors-be-derived-from-v40-vectors).
The crosswalk applies that rubric. It is not an official FIRST crosswalk, and
FIRST does not review it.

What it carries:

- Attack Vector, Privileges Required, and no User Interaction, unchanged.
  Passive and Active User Interaction both become Required.
- 3.1 Attack Complexity is High when 4.0 Attack Complexity is High or Attack
  Requirements is Present, and Low otherwise.
- Scope is Changed when any subsequent-system impact is Low or High, and
  Unchanged otherwise.
- One impact set becomes the 3.1 Confidentiality, Integrity, and Availability
  values: the subsequent-system set when it has more High values, otherwise the
  vulnerable-system set. A tie goes to the vulnerable system. The set that
  loses is omitted.
- Exploit Maturity: Attacked becomes High, Proof-of-Concept stays
  Proof-of-Concept, and Unreported becomes U.

What it does not carry:

- The Supplemental metrics are omitted, because 3.1 has no field for them.
- The Environmental metrics, both the Security Requirements and the Modified
  Base metrics, are omitted, because the rubric derives the 3.1 vector from
  the Base and Threat metrics only.
- Explicit Not Defined (`X`) values are omitted, since writing `X` means the
  same as leaving the metric out.
- The qualitative severity rating has no rule. A translation that includes it
  comes back unmapped for that value, which makes it partial.

A complete 4.0 Base vector gives a complete, valid 3.1 Base vector, whatever
optional metrics it also carries. Every omitted metric is listed in the
result. The suite
[`cvss-40-to-31-tests@1.0.0.yaml`](../../../scheme-folder/test-suites/cvss-40-to-31-tests@1.0.0.yaml)
states the behavior.

`cvss-31-to-40` goes the other way, and it is partial: most 4.0 metrics need an
analyst. See the [`cvss` README](../cvss/README.md#crosswalks).

## Further reading

- [`docs/sources.md`](docs/sources.md): primary and secondary sources.
- [`docs/use-cases.md`](docs/use-cases.md): actors and how they score and consume CVSS.
- [`docs/traceability.md`](docs/traceability.md): mapping from the v4.0 spec to this scheme.
- [`docs/first-org-cvss-v4.md`](docs/first-org-cvss-v4.md): our summary of the FIRST.org v4.0 specification and how this scheme reads it.

For CVSS 3.1, see the [`cvss`](../cvss) scheme.

**Source:** [`../../../scheme-folder/schemes/cvss-v4@4.0.0.yaml`](../../../scheme-folder/schemes/cvss-v4@4.0.0.yaml) &middot; **License:** Apache-2.0
