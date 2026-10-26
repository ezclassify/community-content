# Security Policy

## Supported Versions

| Version | Status             | Security Patches |
| ------- | ------------------ | ---------------- |
| Latest  | Active development | Yes              |

Every scheme carries its own version. Security-sensitive fixes (e.g. a mis-declared constraint that would allow an over-permissive marking) land on the scheme's current major.

## Reporting a Vulnerability

**Do NOT open a public issue for security vulnerabilities.**

Email **security@ezclassify.com** with:

- The scheme id and version affected.
- A description of the issue and how it could be exploited.
- A reproduction, ideally a marking string that shows the incorrect behavior.
- Any suggested remediation.

You will receive an acknowledgment within **48 hours**. We follow a **90-day coordinated disclosure** window.

## What Is a Security Issue for a Scheme

Schemes describe marking systems. They don't execute code, so most "bugs" are authoring errors rather than vulnerabilities. A security-relevant scheme bug is one that, if used against real-world data, would leak, misclassify, or mislabel information in a way that breaks the marking system's own access-control rules. Examples:

- A constraint that should be exclusive but is declared as repeatable, allowing two mutually-exclusive markings to combine.
- A rollup rule that returns a lower-sensitivity marking than the inputs call for.
- A repair rule that silently downgrades a marking.
- A parse rule whose tokenizer misinterprets a dangerous marking as a benign one.

These are **not** security issues:

- Style / typo fixes to descriptions, labels, or rendered strings.
- Incorrect concept guidance that is informational only.
- Disagreements about how a rarely-used edge case should be rendered.

## Contact

For non-vulnerability scheme questions, open an issue on the [central EzClassify tracker](https://github.com/ezclassify/ezclassify/issues/new/choose).
