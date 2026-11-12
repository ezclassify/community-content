# Acme Handling Vocabulary

A fictional corporate handling vocabulary of four tiers, OPEN, COMMUNITY, PARTNERS and INTERNAL, and the reviewed crosswalk `acme-handling-to-tlp` that carries it to TLP 2.0. The website cross-scheme demo translates with them through the `corporate-to-tlp-demo` Context.

**Source:** [`scheme-folder/schemes/acme-handling@1.0.0.yaml`](../../../scheme-folder/schemes/acme-handling@1.0.0.yaml)

## Worked example

```text
Source:  COMMUNITY
Target:  TLP:GREEN   (carried)

Source:  PARTNERS
Target:  review: TLP:AMBER or TLP:AMBER+STRICT
```

OPEN and COMMUNITY carry to a TLP label. PARTNERS and INTERNAL go to review: whether clients may receive the material, and whether an internal-only marking means TLP:RED, are decisions for the information owner, so the crosswalk never infers them.
