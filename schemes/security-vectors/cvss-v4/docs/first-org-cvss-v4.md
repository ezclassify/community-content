# CVSS v4.0, as this scheme reads it

Standard: Common Vulnerability Scoring System v4.0, published November 2023 by
FIRST (Forum of Incident Response and Security Teams). Source of record:
<https://www.first.org/cvss/v4.0/specification-document>.

This page is our summary of that specification, written to explain the choices
in `scheme-folder/schemes/cvss-v4@4.0.0.yaml`. It is not the specification and
does not restate it. Read FIRST's document for the controlling text, the
scoring formula, and the lookup tables.

## The four metric groups

CVSS v4.0 splits its metrics into four groups. The scheme carries all four,
because a vector string may carry all four.

- **Base.** The properties of the vulnerability itself, the ones that do not
  change with time or deployment. All eleven Base metrics are mandatory in a
  v4.0 vector; there is no partial Base assessment.
- **Threat.** What the world currently knows about exploiting it. In v4.0 this
  group is a single metric, Exploit Maturity (E), which replaces the v3.1
  Temporal group.
- **Environmental.** The analyst's own deployment. Security requirements
  (CR, IR, AR) weight the impact metrics by how much the affected asset matters,
  and the Modified Base metrics (MAV through MSA) override a Base value when the
  local environment differs from the reasonable worst case. Every Environmental
  metric defaults to Not Defined (X). For Modified Base metrics, this uses the
  corresponding Base value; for Security Requirements, X has the scoring effect
  of High.
- **Supplemental.** Context a producer can pass along without changing any
  score: Safety (S), Automatable (AU), Recovery (R), Value Density (V),
  Vulnerability Response Effort (RE), and Provider Urgency (U).

FIRST names a vector by the groups it carries: CVSS-B for Base only, then
CVSS-BT, CVSS-BE, and CVSS-BTE as the Threat and Environmental groups are added.

## What the Base metrics measure

- **Attack Vector (AV)** is about reach. Network, Adjacent, Local, and Physical
  describe how close an attacker has to get, from anywhere on the internet down
  to hands on the hardware.
- **Attack Complexity (AC)** is about hardening. High means a working exploit
  depends on defeating a protection that would otherwise stop it.
- **Attack Requirements (AT)** is about the target's own state. Present means
  the attack only works when specific deployment or runtime conditions hold.
- **Privileges Required (PR)** and **User Interaction (UI)** are about who has
  to cooperate: what the attacker must already hold, and what a person other
  than the attacker must do.
- **Impact** is measured twice, once for the vulnerable system (VC, VI, VA) and
  once for systems downstream of it (SC, SI, SA). Splitting the two is the
  change that retired the v3.1 Scope (S) metric.

## Two details worth calling out

- **Safety.** MSI and MSA accept a value, Safety (S), that no Base impact
  metric accepts. It says the consequence reaches the marginal, critical, or
  catastrophic bands of the IEC 61508 consequence categories. The Supplemental
  Safety (S) metric carries the same idea as producer-supplied context. MSC does
  not take the value at all.
- **The qualitative rating.** Critical, High, Medium, Low, and None are
  bands over the numeric score, not part of a vector string. The scheme carries
  them as their own `severity` category with its own render format, so a caller
  can render the rating without polluting the vector.

## What the scheme encodes

- One category per metric, each holding exactly one value, with an exclusivity
  rule so a vector cannot carry two values for the same metric.
- The eleven Base categories marked required, everything else optional.
- Three render formats: `default` emits the full `CVSS:4.0/` vector, `metric`
  emits the bare metric letters, and `severity` emits the qualitative rating on
  its own.
- Case normalization on parse, so a lowercase vector is accepted and the
  correction is recorded.

The per-category `citation` fields in the YAML name the section of the FIRST
specification each category was read from, and `docs/traceability.md` maps
every concept to its section.
