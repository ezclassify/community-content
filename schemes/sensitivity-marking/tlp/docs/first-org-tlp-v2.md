# Traffic Light Protocol (TLP) v2.0, as this scheme reads it

Standard: Traffic Light Protocol v2.0, maintained by FIRST (Forum of Incident
Response and Security Teams). Source of record: <https://www.first.org/tlp/>.

This page is our summary of that standard, written to explain the choices in
`scheme-folder/schemes/tlp@2.0.0.yaml`. It is not the standard and does not
restate it. Read FIRST's page for the controlling text.

## What TLP is for

TLP gives the producer of a report a short label that tells every later holder
how far the report may travel. It is designed for person-to-person and
organization-to-organization sharing of incident and threat material, and it
deliberately stays small enough to be understood without training.

TLP is a sharing convention, not a security classification system. In FIRST's
own words it is "not a 'control marking' or classification scheme"
([FIRST, TLP v2.0](https://www.first.org/tlp/)). It carries no legal authority
of its own, and it does not replace a classification marking where one applies.

## The five labels

Each label answers one question: who may the recipient pass this to?

| Label | Audience the recipient may share with |
| --- | --- |
| `TLP:RED` | No one. The label stops with the people who received it directly. |
| `TLP:AMBER+STRICT` | People inside the recipient's own organization, on a need-to-know basis. |
| `TLP:AMBER` | The recipient's organization and its clients, on a need-to-know basis. |
| `TLP:GREEN` | Peers and partner organizations in the recipient's community, but not on public channels. |
| `TLP:CLEAR` | Anyone. Disclosure is unrestricted, subject to ordinary copyright terms. |

Two points that the levels above imply but are worth stating plainly:

- The boundary tightens as the risk of exposure to the source rises. A producer
  reaches for `TLP:RED` when releasing the material more widely would create
  real harm to the privacy, reputation, or operations of the parties involved.
- `TLP:AMBER+STRICT` exists because `TLP:AMBER` allows a recipient to pass
  material to its clients. Some producers need the organization boundary to be
  hard, and the `+STRICT` variant is how they say so.

## What the scheme encodes

- One category, `tlp_level`, holding exactly one of the five concepts. The
  labels are mutually exclusive, enforced by the `exclusive-tlp` rule.
- Rank order from `TLP:CLEAR` (0) up to `TLP:RED` (4), so a rollup across
  several inputs lands on the most restrictive label present.
- `WHITE` and `TLP:WHITE` as aliases of `TLP:CLEAR`, because v1.0 material
  still circulates under the old name.
- The display colors FIRST publishes for each label, as a scheme-default color
  pair a host may override.

The per-concept `citation` fields in the YAML point at the section of the FIRST
page each concept was read from.
