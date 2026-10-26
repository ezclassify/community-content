## Summary

<!-- What this changes, and why. -->

## Linked issue

<!-- Fixes ezclassify/ezclassify#NNN, or "none" for a small fix. Issues for every EzClassify repository are tracked in ezclassify/ezclassify. -->

## Verification

<!-- Check each command you ran, and note anything you verified by hand. -->

- [ ] `npm run validate`, `npm test`, and `npm run build`
- [ ] `npm run lint`, `npm run typecheck`, and `npm run format:check`
- [ ] `npm run fmt` leaves [`scheme-folder/scheme-folder.yaml`](../scheme-folder/scheme-folder.yaml) unchanged
- [ ] Behavior suites ran with `ezclassify scheme test ./scheme-folder`, or this PR asks a maintainer for a behavioral run

## Checklist

- [ ] New behavior has a test that fails without the change
- [ ] Documentation is updated, or none was needed
- [ ] Commit subjects follow Conventional Commits (`fix:`, `feat:`, `docs:`)
- [ ] Every commit is signed off (`git commit -s`) under the [Developer Certificate of Origin](https://developercertificate.org/)

## Scheme changes

<!-- Delete this section if the PR adds or changes no scheme. -->

- [ ] The file is named `<id>@<version>.yaml` and matches its in-file `id` and `version`
- [ ] At least one test suite covers the scheme and asserts on concept and constraint IDs
- [ ] The scheme README cites its authoritative source
- [ ] Nothing copyrighted, classified, or controlled is included
- [ ] The rest of the [scheme quality checklist](https://github.com/ezclassify/community-content/blob/main/CONTRIBUTING.md#scheme-quality-checklist) is met
