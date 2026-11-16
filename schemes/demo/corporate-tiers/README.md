# Corporate Sensitivity Tiers

A fictional four-tier corporate sensitivity scheme with handling caveats: PUBLIC, INTERNAL, CONFIDENTIAL and RESTRICTED, plus DO NOT FORWARD, NEED TO KNOW, LEGAL HOLD and CUSTOMER DATA. The website multi-scheme and platform demos mark with it through the `corporate-tiers` Context.

**Source:** [`scheme-folder/schemes/corporate-tiers@1.0.0.yaml`](../../../scheme-folder/schemes/corporate-tiers@1.0.0.yaml)

## Worked example

```text
Input A: CONFIDENTIAL
Input B: INTERNAL//DO NOT FORWARD
Rollup:  CONFIDENTIAL//DO NOT FORWARD
```

The tier rolls up to the highest and the caveats combine by union. This is a fictional policy, not a real organization's standard.
