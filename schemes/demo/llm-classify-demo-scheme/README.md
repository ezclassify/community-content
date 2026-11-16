# LLM Classify Demo Scheme

A compact two-category scheme (LOW, MED, HIGH and the control CTRL-A) with the guide `llm-classify-demo-guide` and the access policy `demo-access-policy`. The website LLM classify demo audits its sample document through the `llm-classify-demo` Context, and through `llm-classify-demo-scheme-only` without the guide and the access policy. A marked section covers everything up to the next marked section.

**Source:** [`scheme-folder/schemes/llm-classify-demo-scheme@1.0.0.yaml`](../../../scheme-folder/schemes/llm-classify-demo-scheme@1.0.0.yaml)

## Worked example

```text
Input A: LOW
Input B: MED
Input C: HIGH/CTRL-A
Rollup:  HIGH/CTRL-A
```

The demo's sample document declares MED while one section is marked HIGH, so the audit reports that the banner does not cover its sections.
