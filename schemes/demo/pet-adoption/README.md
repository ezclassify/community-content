# Pet Adoption Catalog

The pet adoption scheme and its intake guide `pet-adoption-intake` that the developer guides teach with. The demo runtime serves them through the `pet-adoption` Context.

**Source:** [`scheme-folder/schemes/pet-adoption@1.0.0.yaml`](../../../scheme-folder/schemes/pet-adoption@1.0.0.yaml)

## Worked example

```text
Input A: PUPPY, ANY HOME
Input B: RABBIT, EXPERIENCED HOME
Input C: DOG, QUIET HOME
Rollup:  DOG, PUPPY, RABBIT, EXPERIENCED HOME
```

A puppy listing is also a dog listing. Animals combine by union and the household fit rolls up to the most demanding one.
