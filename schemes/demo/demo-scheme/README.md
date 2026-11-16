# Marking Guide Demo Scheme

A generic two-category scheme, three levels and two controls, with the marking guides `demo-data-guide` and `comms-guide`. The website marking guide demo scans a sample paragraph with both guides through the `guidebook-demo` Context.

**Source:** [`scheme-folder/schemes/demo-scheme@1.0.0.yaml`](../../../scheme-folder/schemes/demo-scheme@1.0.0.yaml)

## Worked example

```text
Rules:   demo-data-guide ip_addr, facility
Marking: LEVEL-C//CTRL-LOC

Rules:   comms-guide frequency, callsign
Marking: LEVEL-C//CTRL-TOPO
```

Each pair of rules trips a compound rule in its guide. The rules are illustrative, not anyone's handling guidance.
