# Cedar Valley: Protection and Handling

A medium fictional teaching example that adds four human handling instructions to protection. Handling instructions combine by union. They do not technically forward, redact, seal, collect, run a clock, or prove a host action.

**Source:** [`scheme-folder/schemes/cedar-valley-handling@1.0.0.yaml`](../../../scheme-folder/schemes/cedar-valley-handling@1.0.0.yaml)

## Worked example

```text
Input A: INTERNAL//DO NOT FORWARD
Input B: CONFIDENTIAL//REDACT BEFORE RELEASE
Rollup:  CONFIDENTIAL//DO NOT FORWARD/REDACT BEFORE RELEASE
```

The companion access policy compares a trusted protection clearance. The host performs and records the handling actions. This is a fictional policy, not a real district standard.

## Moving to protection alone

The `cedar-valley-handling-to-protection` crosswalk, with its Context of the same name, translates a handling marking to the protection profile, which has the four levels and no handling category. The level carries. DO NOT FORWARD goes to review, REDACT BEFORE RELEASE is omitted, KEEP SEALED forbids the translation, and COLLECT AFTER USE has no decision, so it comes back unmapped.

```text
Input:  INTERNAL//DO NOT FORWARD
Result: partial, INTERNAL (the handling instruction is left to the owner)

Input:  RESTRICTED//KEEP SEALED
Result: forbidden, no target
```

**Source:** [`scheme-folder/crosswalks/cedar-valley-handling-to-protection@1.0.0.yaml`](../../../scheme-folder/crosswalks/cedar-valley-handling-to-protection@1.0.0.yaml)
