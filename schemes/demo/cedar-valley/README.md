# Cedar Valley District Files

A full fictional teaching example for Oakwood Middle School, Pinecrest Middle School, Riverside High School, and the Cedar Valley district office. It demonstrates maximum sensitivity, union, finite-group expansion, intersection, and host-supplied access facts without encoding a district organization chart.

**Source:** [`scheme-folder/schemes/cedar-valley@1.0.0.yaml`](../../../scheme-folder/schemes/cedar-valley@1.0.0.yaml)

## Worked example

```text
Input A: INTERNAL//OAKWOOD/PINECREST//STUDENT TRANSPORTATION SERVICES//DO NOT FORWARD
Input B: CONFIDENTIAL//FINANCIAL INFORMATION//OAKWOOD/PINECREST//REDACT BEFORE RELEASE
Rollup:  CONFIDENTIAL//FINANCIAL INFORMATION//OAKWOOD/PINECREST//DO NOT FORWARD/REDACT BEFORE RELEASE
```

Every nonpublic input implicitly includes Cedar Valley District as an internal recipient. It is hidden from the rendered marking. External permissions are additional and intersect across nonpublic inputs, so the transportation permission above is removed by the district-only purchasing notes. A PUBLIC input contributes no external limit and is neutral when combined with nonpublic material.

Permitted schools are a separate intersection. Blank means no school-specific limit; ALL is the finite Oakwood/Pinecrest/Riverside group. If explicit school limits have no school in common, the aggregate is invalid rather than silently broadening access.

Sensitive-content and handling tags combine by union. Markings describe policy inputs; the host application supplies identity, trusted protection clearance and content permissions, school membership, record relationships, assignments, recipient organization, and evidence that handling actions occurred. This is a fictional policy, not a real district standard.
