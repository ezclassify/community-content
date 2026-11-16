# Access Control Levels and Compartments

A generic scheme of four levels (Public, Internal, Restricted, Critical) and three compartments (Alpha, Bravo, Charlie), with the access policy `access-control-rules`. The website access control demo checks a viewer against it through the `access-control-demo` Context.

**Source:** [`scheme-folder/schemes/access-control@1.0.0.yaml`](../../../scheme-folder/schemes/access-control@1.0.0.yaml)

## Worked example

```text
Data:    Internal//Bravo
Viewer:  level Restricted, compartments Bravo, role analyst, trusted network
Result:  granted
```

The policy requires a level at or above the data's, every compartment the data carries, the analyst role, and a trusted network zone, which the check reads from its context argument.
